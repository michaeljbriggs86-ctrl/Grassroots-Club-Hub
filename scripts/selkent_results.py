"""
Selkent standings parser.

Architecture contract:
- Public Selkent standings are U12+ data and ultimately belong in the
  generalized public static feed.
- Selkent does not expose an explicit "position" column.
- Preserve displayed source sequence as row_order only.
- Never derive or expose official position from row order.
- provider_team_id is optional metadata from resultsTable rows; it is not a
  canonical club ID.

This module only parses a supplied resultsTable HTML payload.
It does not fetch Selkent and it does not publish data.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any

from bs4 import BeautifulSoup, Tag


EXPECTED_HEADERS = [
    "Team",
    "Played",
    "Won",
    "Drawn",
    "Lost",
    "GF",
    "GA",
    "Points",
]

# Verified against the complete captured real resultsTable/4253 payload.
#
# Match the stable explanatory clause rather than the final tie wording.
# Selkent's captured source currently ends "...teams on equal points", but
# matching the stable clause also remains safe if the provider later changes
# that tail to wording such as "...teams level on points".
TIE_DISCLAIMER_PREFIX = (
    "table does not yet take account of rules for determining winner"
)


class StandingsParseError(ValueError):
    """Raised when a resultsTable payload does not match the expected contract."""


def _normalise_text(value: str) -> str:
    return " ".join(value.split())


def _parse_optional_int(value: str, field_name: str) -> int | None:
    """
    Parse an integer cell safely.

    Blank cells and a single dash/en-dash/em-dash are treated as unknown
    rather than zero. This avoids inventing data if Selkent uses a placeholder
    for an unavailable value.

    Signed integers are accepted because points deductions could theoretically
    produce a negative points value.
    """
    text = _normalise_text(value)

    if text in {"", "-", "–", "—"}:
        return None

    compact = text.replace(",", "")

    if not re.fullmatch(r"[+-]?\d+", compact):
        raise StandingsParseError(
            f"Non-integer value for {field_name!r}: {text!r}"
        )

    return int(compact)


def _parse_optional_attr_int(tag: Tag, attribute: str) -> int | None:
    raw = tag.get(attribute)

    if raw is None:
        return None

    text = str(raw).strip()

    if not re.fullmatch(r"\d+", text):
        raise StandingsParseError(
            f"Invalid {attribute} value on team cell: {text!r}"
        )

    return int(text)


def _find_standings_table(soup: BeautifulSoup) -> Tag:
    """
    Find the table whose headers exactly match the verified Selkent standings
    contract. This prevents accidentally parsing another table on the page.

    The complete captured real resultsTable/4253 payload confirms that Selkent
    currently supplies this table using <thead> and <tbody>.
    """
    matches: list[Tag] = []

    for table in soup.find_all("table"):
        header_row = table.find("thead")
        if header_row is None:
            continue

        headers = [
            _normalise_text(th.get_text(" ", strip=True))
            for th in header_row.find_all("th")
        ]

        if headers == EXPECTED_HEADERS:
            matches.append(table)

    if not matches:
        raise StandingsParseError(
            "No Selkent standings table found with expected headers: "
            + ", ".join(EXPECTED_HEADERS)
        )

    if len(matches) > 1:
        raise StandingsParseError(
            f"Expected exactly one standings table, found {len(matches)}"
        )

    return matches[0]


def _extract_division_metadata(
    table: Tag,
) -> tuple[str | None, str | None]:
    """
    Extract division name and source update text.

    The complete captured real resultsTable/4253 payload confirms the current
    Selkent structure:
      div.panel.panel-static
        div.panel-heading
          span (division name)
          span.pull-right (Updated at: ...)
    """
    panel = table.find_parent(
        "div",
        class_=lambda value: value and "panel-static" in str(value).split(),
    )

    if panel is None:
        return None, None

    heading = panel.select_one(".panel-heading")

    if heading is None:
        return None, None

    updated_el = heading.select_one(".pull-right")

    updated_at_text: str | None = None
    if updated_el is not None:
        raw_updated = _normalise_text(updated_el.get_text(" ", strip=True))
        raw_updated = re.sub(
            r"^\s*Updated\s+at\s*:\s*",
            "",
            raw_updated,
            flags=re.IGNORECASE,
        )
        updated_at_text = raw_updated or None

    division_name: str | None = None

    for candidate in heading.find_all(["span", "div", "h1", "h2", "h3", "h4"]):
        if updated_el is not None and (
            candidate is updated_el or updated_el in candidate.descendants
        ):
            continue

        text = _normalise_text(candidate.get_text(" ", strip=True))
        if text and not text.lower().startswith("updated at"):
            division_name = text
            break

    if division_name is None:
        full_text = _normalise_text(heading.get_text(" ", strip=True))
        full_text = re.sub(
            r"\s*Updated\s+at\s*:.*$",
            "",
            full_text,
            flags=re.IGNORECASE,
        ).strip()
        division_name = full_text or None

    return division_name, updated_at_text


def _extract_tie_disclaimer(soup: BeautifulSoup) -> str | None:
    """
    Return Selkent's table-order disclaimer when present.

    Match the stable explanatory clause instead of the final wording about
    tied points. This avoids silently losing source_disclaimer if Selkent
    changes "on equal points" to an equivalent phrase.
    """
    for element in soup.find_all(string=True):
        text = _normalise_text(str(element))
        if TIE_DISCLAIMER_PREFIX in text.lower():
            return text
    return None


def parse_standings_html(html: str) -> dict[str, Any]:
    """
    Parse one Selkent resultsTable HTML payload.

    Returns:
        {
          "division_name": str | None,
          "updated_at_text": str | None,
          "source_order_authoritative_for_ties": False,
          "source_disclaimer": str | None,
          "rows": [
             {
               "row_order": 1,
               "provider_team_id": int | None,
               "provider_division_id": int | None,
               "team_name": str,
               "played": int | None,
               "won": int | None,
               "drawn": int | None,
               "lost": int | None,
               "gf": int | None,
               "ga": int | None,
               "points": int | None
             }
          ]
        }

    Deliberately does NOT return "position".
    """
    if not isinstance(html, str) or not html.strip():
        raise StandingsParseError("Standings HTML is empty")

    soup = BeautifulSoup(html, "html.parser")
    table = _find_standings_table(soup)

    tbody = table.find("tbody")
    if tbody is None:
        raise StandingsParseError("Standings table has no <tbody>")

    rows: list[dict[str, Any]] = []

    for tr in tbody.find_all("tr", recursive=False):
        cells = tr.find_all("td", recursive=False)

        if not cells:
            continue

        if len(cells) != 8:
            raise StandingsParseError(
                f"Standings row has {len(cells)} cells; expected 8"
            )

        team_cell = cells[0]
        team_name = _normalise_text(team_cell.get_text(" ", strip=True))

        if not team_name:
            raise StandingsParseError("Standings row has an empty team name")

        rows.append(
            {
                "row_order": len(rows) + 1,
                "provider_team_id": _parse_optional_attr_int(
                    team_cell, "data-team-id"
                ),
                "provider_division_id": _parse_optional_attr_int(
                    team_cell, "data-division-id"
                ),
                "team_name": team_name,
                "played": _parse_optional_int(
                    cells[1].get_text(" ", strip=True), "played"
                ),
                "won": _parse_optional_int(
                    cells[2].get_text(" ", strip=True), "won"
                ),
                "drawn": _parse_optional_int(
                    cells[3].get_text(" ", strip=True), "drawn"
                ),
                "lost": _parse_optional_int(
                    cells[4].get_text(" ", strip=True), "lost"
                ),
                "gf": _parse_optional_int(
                    cells[5].get_text(" ", strip=True), "gf"
                ),
                "ga": _parse_optional_int(
                    cells[6].get_text(" ", strip=True), "ga"
                ),
                "points": _parse_optional_int(
                    cells[7].get_text(" ", strip=True), "points"
                ),
            }
        )

    division_name, updated_at_text = _extract_division_metadata(table)

    return {
        "division_name": division_name,
        "updated_at_text": updated_at_text,
        "source_order_authoritative_for_ties": False,
        "source_disclaimer": _extract_tie_disclaimer(soup),
        "rows": rows,
    }


def parse_standings_file(path: str | Path) -> dict[str, Any]:
    path = Path(path)
    return parse_standings_html(path.read_text(encoding="utf-8"))


def main(argv: list[str] | None = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)

    if len(argv) != 1:
        print(
            "Usage: python scripts/selkent_results.py "
            "<resultsTable-html-file>",
            file=sys.stderr,
        )
        return 2

    try:
        result = parse_standings_file(argv[0])
    except (OSError, StandingsParseError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
