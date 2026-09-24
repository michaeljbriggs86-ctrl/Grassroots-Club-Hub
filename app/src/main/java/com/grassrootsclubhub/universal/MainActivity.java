package com.grassrootsclubhub.universal;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.CalendarContract;
import android.util.Base64;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.ValueCallback;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

public class MainActivity extends Activity {
    private WebView webView;
    private int topInset = 0, bottomInset = 0;
    private boolean pageReady = false;
    private String pendingAuthUri = null;
    private ValueCallback<Uri[]> filePathCallback = null;
    private static final int FILE_CHOOSER_REQUEST = 5173;
    private static final String NATIVE_USER_AGENT = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36 GrassrootsClubHub/2.2.26";
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        setContentView(webView);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setAllowFileAccessFromFileURLs(false);
        s.setAllowUniversalAccessFromFileURLs(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setUserAgentString(NATIVE_USER_AGENT);

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false);
        webView.addJavascriptInterface(new NativeBridge(), "ClubHubNative");
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePath, WebChromeClient.FileChooserParams fileChooserParams) {
                if (filePathCallback != null) filePathCallback.onReceiveValue(null);
                filePathCallback = filePath;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("image/*");
                intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"image/png", "image/jpeg", "image/webp"});
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
                try {
                    startActivityForResult(Intent.createChooser(intent, "Choose club badge"), FILE_CHOOSER_REQUEST);
                    return true;
                } catch (Exception first) {
                    try {
                        Intent fallback = new Intent(Intent.ACTION_GET_CONTENT);
                        fallback.addCategory(Intent.CATEGORY_OPENABLE);
                        fallback.setType("image/*");
                        fallback.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"image/png", "image/jpeg", "image/webp"});
                        startActivityForResult(Intent.createChooser(fallback, "Choose club badge"), FILE_CHOOSER_REQUEST);
                        return true;
                    } catch (Exception second) {
                        filePathCallback.onReceiveValue(null);
                        filePathCallback = null;
                        return false;
                    }
                }
            }
        });
        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                String scheme = u.getScheme();
                if ("grassrootsclubhub".equalsIgnoreCase(scheme)) {
                    queueAuthCallback(u.toString());
                    return true;
                }
                if ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme)) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) {}
                    return true;
                }
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) {}
                return true;
            }

            @Override public void onPageFinished(WebView v, String url) {
                super.onPageFinished(v, url);
                if (url != null && url.startsWith("file:///android_asset/index.html")) {
                    pageReady = true;
                    applySystemInsetToPage();
                    dispatchPendingAuthCallback(0);
                }
            }
        });

        webView.setOnApplyWindowInsetsListener((v, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                Insets t = insets.getInsets(WindowInsets.Type.statusBars());
                Insets b = insets.getInsets(WindowInsets.Type.navigationBars());
                topInset = t.top;
                bottomInset = b.bottom;
            } else {
                topInset = insets.getSystemWindowInsetTop();
                bottomInset = insets.getSystemWindowInsetBottom();
            }
            applySystemInsetToPage();
            return insets;
        });

        handleIntent(getIntent());
        webView.loadUrl("file:///android_asset/index.html?build=cloud");
        webView.requestApplyInsets();
    }

    private void applySystemInsetToPage() {
        if (webView == null || !pageReady) return;

        // WindowInsets are reported in physical pixels, while WebView CSS uses CSS px/dp-like units.
        // Passing physical pixels directly caused exaggerated blank space on high-density phones.
        float density = getResources().getDisplayMetrics().density;
        if (density <= 0f) density = 1f;
        int cssTopInset = Math.min(56, Math.max(0, Math.round(topInset / density)));
        int cssBottomInset = Math.min(72, Math.max(0, Math.round(bottomInset / density)));

        webView.evaluateJavascript(
            "document.documentElement.style.setProperty('--android-inset-top','" + cssTopInset + "px');" +
            "document.documentElement.style.setProperty('--android-inset-bottom','" + cssBottomInset + "px');" +
            "window.dispatchEvent(new CustomEvent('android-inset-change',{detail:{top:" + cssTopInset + ",bottom:" + cssBottomInset + "}}));",
            null
        );
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }

    private void handleIntent(Intent intent) {
        if (intent == null || intent.getData() == null) return;
        Uri data = intent.getData();
        if (!"grassrootsclubhub".equalsIgnoreCase(data.getScheme())) return;
        queueAuthCallback(data.toString());
    }

    private void queueAuthCallback(String uri) {
        pendingAuthUri = uri;
        dispatchPendingAuthCallback(0);
    }

    private void dispatchPendingAuthCallback(int attempt) {
        if (!pageReady || webView == null || pendingAuthUri == null) return;
        final String uri = pendingAuthUri;
        final String js = "(function(){" +
            "if(window.ClubHubCloud&&window.ClubHubCloud.handleAuthCallback){" +
            "Promise.resolve(window.ClubHubCloud.handleAuthCallback(" + JSONObject.quote(uri) + ")).catch(function(){});" +
            "return 'delivered';}" +
            "return 'wait';" +
            "})()";
        webView.evaluateJavascript(js, value -> {
            if (value != null && value.contains("delivered")) {
                if (uri.equals(pendingAuthUri)) pendingAuthUri = null;
                return;
            }
            if (attempt < 40) mainHandler.postDelayed(() -> dispatchPendingAuthCallback(attempt + 1), 100);
        });
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != FILE_CHOOSER_REQUEST || filePathCallback == null) return;
        Uri[] results = null;
        if (resultCode == RESULT_OK && data != null) {
            if (data.getClipData() != null) {
                int count = data.getClipData().getItemCount();
                results = new Uri[count];
                for (int i = 0; i < count; i++) results[i] = data.getClipData().getItemAt(i).getUri();
            } else if (data.getData() != null) {
                results = new Uri[]{data.getData()};
                try { getContentResolver().takePersistableUriPermission(data.getData(), Intent.FLAG_GRANT_READ_URI_PERMISSION); } catch (Exception ignored) {}
            }
        }
        filePathCallback.onReceiveValue(results);
        filePathCallback = null;
    }

    @Override public void onBackPressed() {
        webView.evaluateJavascript(";(window.closeTopDialog && window.closeTopDialog()) === true", v -> {
            if ("true".equals(v)) return;
            if (webView.canGoBack()) webView.goBack(); else super.onBackPressed();
        });
    }

    private static final String STATIC_FEED_HOST = "raw.githubusercontent.com";
    private static final String STATIC_DIRECTORY_PATH = "/michaeljbriggs86-ctrl/Grassroots-Club-Hub/main/data/directory.json";
    private static final String STATIC_RESULTS_PATH = "/michaeljbriggs86-ctrl/Grassroots-Club-Hub/main/data/results.json";
    private static final int MAX_HTTP_REDIRECTS = 5;

    private boolean isAllowedSelkentUrl(String value) {
        try {
            URL parsed = new URL(value);
            String host = parsed.getHost() == null ? "" : parsed.getHost().toLowerCase();
            int port = parsed.getPort();
            return "https".equalsIgnoreCase(parsed.getProtocol())
                && (port == -1 || port == 443)
                && parsed.getUserInfo() == null
                && ("selkent.org.uk".equals(host) || "www.selkent.org.uk".equals(host));
        } catch (Exception ignored) {
            return false;
        }
    }

    private boolean isAllowedStaticFeedUrl(String value) {
        try {
            URL parsed = new URL(value);
            String host = parsed.getHost() == null ? "" : parsed.getHost().toLowerCase();
            String path = parsed.getPath() == null ? "" : parsed.getPath();
            int port = parsed.getPort();
            boolean approvedPath = STATIC_DIRECTORY_PATH.equals(path) || STATIC_RESULTS_PATH.equals(path);
            return "https".equalsIgnoreCase(parsed.getProtocol())
                && (port == -1 || port == 443)
                && STATIC_FEED_HOST.equals(host)
                && approvedPath
                && parsed.getUserInfo() == null
                && parsed.getQuery() == null
                && parsed.getRef() == null;
        } catch (Exception ignored) {
            return false;
        }
    }

    private boolean isAllowedNativeRequest(String value, String method, boolean staticFamily) {
        if (staticFamily) return "GET".equals(method) && isAllowedStaticFeedUrl(value);
        return isAllowedSelkentUrl(value);
    }

    final class NativeBridge {
        private final Handler main = new Handler(Looper.getMainLooper());

        @JavascriptInterface public void request(String requestId, String url, String method, String body) {
            new Thread(() -> doRequest(requestId, url, method, body)).start();
        }

        private void doRequest(String requestId, String url, String method, String body) {
            int status = 0; String text = "", error = ""; HttpURLConnection c = null;
            String m = (method == null || method.isEmpty() ? "GET" : method.toUpperCase());
            boolean staticFamily = isAllowedStaticFeedUrl(url);
            boolean selkentFamily = isAllowedSelkentUrl(url);

            try {
                if (!staticFamily && !selkentFamily) throw new SecurityException("Blocked URL");
                if (!isAllowedNativeRequest(url, m, staticFamily)) throw new SecurityException("Blocked method or URL");

                URL current = new URL(url);
                String requestBody = body == null ? "" : body;

                for (int redirects = 0; redirects <= MAX_HTTP_REDIRECTS; redirects++) {
                    String currentUrl = current.toString();
                    if (!isAllowedNativeRequest(currentUrl, m, staticFamily)) throw new SecurityException("Blocked redirect target");

                    c = (HttpURLConnection) current.openConnection();
                    c.setInstanceFollowRedirects(false);
                    c.setConnectTimeout(15000);
                    c.setReadTimeout(20000);
                    c.setRequestMethod(m);
                    c.setRequestProperty("User-Agent", NATIVE_USER_AGENT);
                    c.setRequestProperty("Accept", staticFamily
                        ? "application/json,text/plain;q=0.9,*/*;q=0.8"
                        : "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8");

                    if (!staticFamily) {
                        String cookies = CookieManager.getInstance().getCookie(currentUrl);
                        if (cookies != null && !cookies.isEmpty()) c.setRequestProperty("Cookie", cookies);
                    }

                    if (!"GET".equals(m) && !requestBody.isEmpty()) {
                        c.setDoOutput(true);
                        c.setRequestProperty("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8");
                        try (OutputStream os = c.getOutputStream()) { os.write(requestBody.getBytes(StandardCharsets.UTF_8)); }
                    }

                    status = c.getResponseCode();

                    if (!staticFamily) {
                        Map<String, List<String>> headers = c.getHeaderFields();
                        List<String> setCookies = headers.get("Set-Cookie");
                        if (setCookies != null) for (String ck : setCookies) CookieManager.getInstance().setCookie(currentUrl, ck);
                    }

                    if (status == HttpURLConnection.HTTP_MOVED_PERM
                        || status == HttpURLConnection.HTTP_MOVED_TEMP
                        || status == HttpURLConnection.HTTP_SEE_OTHER
                        || status == 307 || status == 308) {
                        if (redirects >= MAX_HTTP_REDIRECTS) throw new SecurityException("Too many redirects");
                        String location = c.getHeaderField("Location");
                        if (location == null || location.trim().isEmpty()) throw new SecurityException("Redirect missing Location");
                        if (!"GET".equals(m)) throw new SecurityException("Redirect blocked for non-GET request");
                        URL next = new URL(current, location);
                        if (!isAllowedNativeRequest(next.toString(), m, staticFamily)) throw new SecurityException("Blocked redirect target");
                        c.disconnect(); c = null; current = next; continue;
                    }

                    InputStream in = status >= 400 ? c.getErrorStream() : c.getInputStream();
                    text = read(in);
                    break;
                }
            } catch (Exception e) {
                error = e.getMessage() == null ? e.toString() : e.getMessage();
            } finally {
                if (c != null) c.disconnect();
            }
            final int st = status; final String tx = text, er = error;
            main.post(() -> webView.evaluateJavascript("window.__nativeFetchResolve(" + JSONObject.quote(requestId) + "," + st + "," + JSONObject.quote(tx) + "," + JSONObject.quote(er) + ")", null));
        }

        private String read(InputStream in) throws Exception {
            if (in == null) return "";
            StringBuilder b = new StringBuilder();
            try (BufferedReader r = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8))) {
                String line; while ((line = r.readLine()) != null) b.append(line).append('\n');
            }
            return b.toString();
        }

        @JavascriptInterface public void renderPage(String requestId, String url, String choicesJson) {
            main.post(() -> startRenderer(requestId, url, choicesJson));
        }

        private void startRenderer(String requestId, String url, String choicesJson) {
            if (!isAllowedSelkentUrl(url)) {
                resolveRendered(requestId, 0, "", "Blocked non-Selkent URL", url);
                return;
            }
            final WebView renderer = new WebView(MainActivity.this);
            WebSettings s = renderer.getSettings();
            s.setJavaScriptEnabled(true);
            s.setDomStorageEnabled(true);
            s.setAllowFileAccess(false);
            s.setAllowContentAccess(false);
            s.setAllowFileAccessFromFileURLs(false);
            s.setAllowUniversalAccessFromFileURLs(false);
            s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
            s.setUserAgentString(NATIVE_USER_AGENT);
            CookieManager.getInstance().setAcceptThirdPartyCookies(renderer, false);
            final JSONArray choices;
            try { choices = new JSONArray(choicesJson == null ? "[]" : choicesJson); }
            catch (Exception e) { resolveRendered(requestId, 0, "", e.getMessage(), url); renderer.destroy(); return; }
            final int[] idx = {0}; final String[] lastUrl = {url}; final Handler h = new Handler(Looper.getMainLooper());
            renderer.setWebViewClient(new WebViewClient() {
                @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest request) {
                    String target = request.getUrl() == null ? "" : request.getUrl().toString();
                    if (!isAllowedSelkentUrl(target)) {
                        resolveRendered(requestId, 0, "", "Blocked renderer redirect", lastUrl[0]);
                        renderer.destroy();
                        return true;
                    }
                    return false;
                }
                @Override public void onPageFinished(WebView v, String pageUrl) {
                    if (!isAllowedSelkentUrl(pageUrl)) {
                        resolveRendered(requestId, 0, "", "Blocked renderer redirect", lastUrl[0]);
                        renderer.destroy();
                        return;
                    }
                    lastUrl[0] = pageUrl; h.postDelayed(this::advance, 650);
                }
                private void advance() {
                    if (idx[0] >= choices.length()) {
                        renderer.evaluateJavascript("(function(){return document.documentElement?document.documentElement.outerHTML:'';})()", value -> {
                            String html = unquote(value); resolveRendered(requestId, 200, html, "", lastUrl[0]); renderer.destroy();
                        });
                        return;
                    }
                    String choice = choices.optString(idx[0]++, "");
                    String script = "(function(choice){const n=s=>String(s||'').toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,' ').trim().replace(/\\s+/g,' ');const target=n(choice);const els=[...document.querySelectorAll('a,button,summary,[role=tab],[role=button],label,option')];let el=els.find(x=>n(x.textContent||x.value)===target)||els.find(x=>target.length>2&&n(x.textContent||x.value).includes(target));if(!el)return 'missing';if(el.tagName==='OPTION'){const sel=el.parentElement;sel.value=el.value;el.selected=true;sel.dispatchEvent(new Event('change',{bubbles:true}));sel.dispatchEvent(new Event('input',{bubbles:true}));return 'changed';}el.scrollIntoView({block:'center'});el.click();return 'clicked';})(" + JSONObject.quote(choice) + ")";
                    renderer.evaluateJavascript(script, value -> h.postDelayed(this::advance, 900));
                }
            });
            renderer.loadUrl(url);
        }

        private String unquote(String value) {
            if (value == null || "null".equals(value)) return "";
            try { return new JSONArray("[" + value + "]").getString(0); } catch (Exception e) { return value; }
        }

        private void resolveRendered(String id, int status, String html, String error, String finalUrl) {
            webView.evaluateJavascript("window.__nativeRenderResolve(" + JSONObject.quote(id) + "," + status + "," + JSONObject.quote(html) + "," + JSONObject.quote(error == null ? "" : error) + "," + JSONObject.quote(finalUrl == null ? "" : finalUrl) + ")", null);
        }

        @JavascriptInterface public boolean isDebugBuild() { return (getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0; }

        @JavascriptInterface public void addCalendarEvent(String title, String description, String location, String startIso, String endIso) {
            main.post(() -> {
                try {
                    java.time.ZonedDateTime start = java.time.ZonedDateTime.parse(startIso);
                    java.time.ZonedDateTime end = java.time.ZonedDateTime.parse(endIso);
                    Intent intent = new Intent(Intent.ACTION_INSERT)
                        .setData(CalendarContract.Events.CONTENT_URI)
                        .putExtra(CalendarContract.Events.TITLE, title == null ? "Club fixture" : title)
                        .putExtra(CalendarContract.Events.DESCRIPTION, description == null ? "" : description)
                        .putExtra(CalendarContract.Events.EVENT_LOCATION, location == null ? "" : location)
                        .putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, start.toInstant().toEpochMilli())
                        .putExtra(CalendarContract.EXTRA_EVENT_END_TIME, end.toInstant().toEpochMilli());
                    startActivity(intent);
                } catch (Exception ignored) {}
            });
        }

        @JavascriptInterface public void sharePngDataUrl(String dataUrl) {
            main.post(() -> {
                try {
                    String value = dataUrl == null ? "" : dataUrl;
                    int comma = value.indexOf(',');
                    if (comma < 0 || !value.substring(0, comma).toLowerCase().contains("image/png")) return;
                    byte[] bytes = Base64.decode(value.substring(comma + 1), Base64.DEFAULT);
                    if (bytes.length == 0 || bytes.length > 2_000_000) return;
                    File dir = new File(getCacheDir(), "share");
                    if (!dir.exists() && !dir.mkdirs()) return;
                    File target = new File(dir, "match-card.png");
                    try (FileOutputStream out = new FileOutputStream(target, false)) { out.write(bytes); }
                    Uri uri = Uri.parse("content://" + getPackageName() + ".share/match-card.png");
                    Intent share = new Intent(Intent.ACTION_SEND)
                        .setType("image/png")
                        .putExtra(Intent.EXTRA_STREAM, uri)
                        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    startActivity(Intent.createChooser(share, "Share match"));
                } catch (Exception ignored) {}
            });
        }

        @JavascriptInterface public void reloadApp() {
            main.post(() -> {
                pageReady = false;
                webView.clearHistory();
                webView.loadUrl("file:///android_asset/index.html?build=cloud");
            });
        }

        @JavascriptInterface public String signAssignment(String payloadB64) { return ""; }
        @JavascriptInterface public boolean verifyAssignment(String payloadB64, String signature) { return false; }
    }
}
