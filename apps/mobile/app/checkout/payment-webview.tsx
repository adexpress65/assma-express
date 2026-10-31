import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  Linking,
  BackHandler,
  TouchableOpacity,
} from "react-native";
import { WebView } from "react-native-webview";
import type { WebViewMessageEvent } from "react-native-webview";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  NGENIUS_RETURN_HOSTS,
  NGENIUS_RETURN_PATHS,
  NGENIUS_VERIFIABLE_RETURN_PATHS,
} from "@/config/api";

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

/**
 * Résultat d'analyse d'une URL traversée par la WebView.
 * `returned` signifie uniquement « page de retour atteinte » : l'issue réelle du
 * paiement est décidée par le backend, jamais par le contenu de l'URL.
 */
type UrlOutcome =
  | "continue"
  | "returned"
  | "cancelled"
  | "failed"
  | "storefront";

type UrlAnalysis = {
  outcome: UrlOutcome;
  reason: string;
};

const CANCEL_TOKENS = ["cancel", "cancelled", "canceled", "abort", "aborted"];

const FAILURE_TOKENS = [
  "fail",
  "failed",
  "failure",
  "declined",
  "decline",
  "error",
  "reject",
  "rejected",
  "expired",
  "unsuccessful",
];

const STATUS_PARAM_KEYS = [
  "status",
  "state",
  "result",
  "outcome",
  "paymentstatus",
  "payment_status",
  "transactionstatus",
];

/**
 * Page NGenius « Payment accepted » : le client n'a pas besoin d'appuyer sur
 * « Return to basket » pour que la commande soit vérifiée.
 */
const DETECT_PAYMENT_RESULT_JS = `
(function() {
  function check() {
    try {
      var text = (document.body && (document.body.innerText || document.body.textContent) || '').toLowerCase();
      var accepted =
        text.indexOf('payment accepted') !== -1 ||
        text.indexOf('paiement accept') !== -1 ||
        text.indexOf('your payment has been accepted') !== -1 ||
        text.indexOf('votre paiement a été accept') !== -1 ||
        text.indexOf('votre paiement a ete accept') !== -1;
      if (!accepted || window.__a2PaymentResultSent) return;
      window.__a2PaymentResultSent = true;
      var nodes = document.querySelectorAll('a, button, input[type="submit"], input[type="button"]');
      for (var i = 0; i < nodes.length; i++) {
        var t = ((nodes[i].innerText || nodes[i].value || nodes[i].textContent || '') + '').toLowerCase();
        if (
          t.indexOf('return to basket') !== -1 ||
          t.indexOf('retourner au panier') !== -1 ||
          t.indexOf('retour au panier') !== -1
        ) {
          try { nodes[i].click(); } catch (e) {}
          break;
        }
      }
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'payment-accepted' }));
      }
    } catch (e) {}
  }
  check();
  var n = 0;
  var iv = setInterval(function() {
    check();
    n += 1;
    if (n > 40 || window.__a2PaymentResultSent) clearInterval(iv);
  }, 500);
})();
true;
`;

function normalizeHost(host: string): string {
  return host.toLowerCase().replace(/^www\./, "");
}

function safeParseUrl(raw: string): URL | null {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

function isReturnHost(host: string): boolean {
  const normalized = normalizeHost(host);
  return NGENIUS_RETURN_HOSTS.some(
    (allowed) => normalizeHost(allowed) === normalized,
  );
}

function matchesToken(value: string, tokens: string[]): boolean {
  const normalized = value.toLowerCase().trim();
  return tokens.some((token) => normalized === token || normalized.includes(token));
}

/**
 * NGenius utilise `redirectUrl` pour TOUTES les issues (succès, refus bancaire,
 * 3DS échoué). On n'accorde donc aucune valeur de succès au chemin `/success` :
 * on se contente de détecter qu'on est revenu sur notre domaine.
 */
function analyzeUrl(rawUrl: string): UrlAnalysis {
  const parsed = safeParseUrl(rawUrl);

  if (!parsed) {
    return { outcome: "continue", reason: "url-non-analysable" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { outcome: "continue", reason: "schema-non-http" };
  }

  // Tant qu'on est sur le domaine de la passerelle, aucune décision n'est prise :
  // ses URLs contiennent les redirectUrl/cancelUrl encodées et provoquaient
  // auparavant de fausses détections de succès.
  if (!isReturnHost(parsed.hostname)) {
    return { outcome: "continue", reason: "domaine-passerelle" };
  }

  const path = parsed.pathname.toLowerCase();
  const params = parsed.searchParams;

  for (const key of STATUS_PARAM_KEYS) {
    const value = params.get(key);
    if (!value) continue;
    if (matchesToken(value, CANCEL_TOKENS)) {
      return { outcome: "cancelled", reason: `param-${key}=${value}` };
    }
    if (matchesToken(value, FAILURE_TOKENS)) {
      return { outcome: "failed", reason: `param-${key}=${value}` };
    }
  }

  if (
    path === NGENIUS_RETURN_PATHS.cancel.toLowerCase() ||
    matchesToken(path, CANCEL_TOKENS)
  ) {
    return { outcome: "cancelled", reason: "chemin-annulation" };
  }

  if (matchesToken(path, FAILURE_TOKENS)) {
    return { outcome: "failed", reason: "chemin-echec" };
  }

  // Aucun de ces chemins ne vaut preuve de paiement, y compris l'ancien
  // `success.html` : seule la vérification serveur tranche.
  const verifiablePath = NGENIUS_VERIFIABLE_RETURN_PATHS.find(
    (candidate) => candidate.toLowerCase() === path,
  );
  if (verifiablePath) {
    return { outcome: "returned", reason: `chemin-retour-a-verifier:${verifiablePath}` };
  }

  return { outcome: "storefront", reason: "retour-boutique" };
}

export default function PaymentWebView() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    paymentUrl?: string | string[];
    orderId?: string | string[];
  }>();

  const paymentUrl = firstParam(params.paymentUrl);
  const orderId = firstParam(params.orderId) ?? "";

  const [loading, setLoading] = useState(true);
  const handledRef = useRef(false);
  const isInitializingRef = useRef(false);
  const acceptedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const webViewRef = useRef<WebView>(null);

  const goToPending = useCallback(
    (reason: string) => {
      if (handledRef.current) return;
      handledRef.current = true;
      if (acceptedTimeoutRef.current) {
        clearTimeout(acceptedTimeoutRef.current);
        acceptedTimeoutRef.current = null;
      }
      console.log("[PaymentWebView] Vérification serveur", { orderId, reason });
      router.replace({
        pathname: "/checkout/pending" as never,
        params: { orderId },
      });
    },
    [orderId, router],
  );

  useEffect(() => {
    if (isInitializingRef.current) return;
    if (!paymentUrl || typeof paymentUrl !== "string") {
      isInitializingRef.current = true;
      router.replace("/");
    }
  }, [paymentUrl, router]);

  useEffect(() => {
    const onBack = () => {
      goToPending("hardware-back");
      return true;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBack);
    return () => {
      sub.remove();
      if (acceptedTimeoutRef.current) clearTimeout(acceptedTimeoutRef.current);
    };
  }, [goToPending]);

  /**
   * @returns `true` si la WebView doit continuer à charger l'URL.
   */
  const handleUrl = (source: string, url: string): boolean => {
    if (handledRef.current) return false;

    const parsed = safeParseUrl(url);
    const analysis = analyzeUrl(url);

    console.log("[PaymentWebView] URL reçue", {
      source,
      orderId,
      url,
      protocol: parsed?.protocol ?? null,
      host: parsed?.hostname ?? null,
      pathname: parsed?.pathname ?? null,
      search: parsed?.search ?? null,
      query: parsed ? Object.fromEntries(parsed.searchParams.entries()) : null,
      outcome: analysis.outcome,
      reason: analysis.reason,
    });

    if (analysis.outcome === "continue") return true;

    handledRef.current = true;

    switch (analysis.outcome) {
      // Retour sur notre domaine : l'issue est inconnue à ce stade, c'est le
      // backend puis Firestore qui tranchent depuis l'écran d'attente.
      case "returned":
        console.log(
          "[PaymentWebView] Retour passerelle -> vérification serveur requise",
          { orderId },
        );
        router.replace({
          pathname: "/checkout/pending" as never,
          params: { orderId },
        });
        break;

      case "cancelled":
      case "failed":
        console.log("[PaymentWebView] Paiement non abouti", {
          orderId,
          status: analysis.outcome === "cancelled" ? "cancel" : "failed",
          reason: analysis.reason,
        });
        router.replace({
          pathname: "/checkout/confirmation" as never,
          params: {
            status: analysis.outcome === "cancelled" ? "cancel" : "failed",
            orderId,
          },
        });
        break;

      case "storefront":
        console.log("[PaymentWebView] Retour boutique -> vérification serveur", {
          orderId,
        });
        router.replace({
          pathname: "/checkout/pending" as never,
          params: { orderId },
        });
        break;
    }

    return false;
  };

  const handleShouldStart = (request: { url: string }) => {
    const { url } = request;

    if (!url.startsWith("http")) {
      console.log("[PaymentWebView] Lien externe intercepté", { url });
      Linking.openURL(url).catch((err) =>
        console.log("[PaymentWebView] Erreur d'ouverture de lien externe:", err),
      );
      return false;
    }

    return handleUrl("onShouldStartLoadWithRequest", url);
  };

  const handleWebViewMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as { type?: string };
      if (data?.type !== "payment-accepted") return;
    } catch {
      return;
    }

    if (handledRef.current) return;
    console.log("[PaymentWebView] Page « Payment accepted » détectée", { orderId });
    if (acceptedTimeoutRef.current) clearTimeout(acceptedTimeoutRef.current);
    // Laisse une chance au clic auto sur « Return to basket » (redirection URL).
    acceptedTimeoutRef.current = setTimeout(() => {
      goToPending("payment-accepted-page");
    }, 1200);
  };

  if (!paymentUrl || typeof paymentUrl !== "string") return null;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.miniHeader}>
        <Text style={styles.secureText}>Paiement Sécurisé - A2Express</Text>
        <TouchableOpacity
          onPress={() => goToPending("manual-continue")}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.continueText}>Continuer</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.container}>
        {loading && (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color="#FF6A00" />
            <Text style={styles.loadingText}>
              Connexion à la passerelle bancaire...
            </Text>
          </View>
        )}

        <WebView
          ref={webViewRef}
          source={{ uri: paymentUrl }}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState={false}
          originWhitelist={["*"]}
          setSupportMultipleWindows={false}
          mixedContentMode="always"
          injectedJavaScript={DETECT_PAYMENT_RESULT_JS}
          onMessage={handleWebViewMessage}
          onLoadEnd={() => {
            setLoading(false);
            webViewRef.current?.injectJavaScript(DETECT_PAYMENT_RESULT_JS);
          }}
          onShouldStartLoadWithRequest={handleShouldStart}
          onNavigationStateChange={(navState) => {
            // Filet de sécurité : sur Android, les redirections 302 de la
            // passerelle ne déclenchent pas toujours onShouldStartLoadWithRequest.
            handleUrl("onNavigationStateChange", navState.url);
          }}
          onError={({ nativeEvent }) =>
            console.log("[PaymentWebView] Erreur de chargement", {
              url: nativeEvent.url,
              description: nativeEvent.description,
            })
          }
          onHttpError={({ nativeEvent }) =>
            console.log("[PaymentWebView] Erreur HTTP", {
              url: nativeEvent.url,
              statusCode: nativeEvent.statusCode,
            })
          }
          style={styles.webview}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#fff",
  },
  container: {
    flex: 1,
    position: "relative",
  },
  miniHeader: {
    height: 40,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    backgroundColor: "#F7FAFC",
  },
  secureText: {
    fontSize: 12,
    color: "#2D3748",
    fontWeight: "700",
  },
  continueText: {
    fontSize: 13,
    color: "#FF6A00",
    fontWeight: "700",
  },
  webview: {
    flex: 1,
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  loadingText: {
    marginTop: 15,
    fontSize: 14,
    color: "#718096",
    fontWeight: "500",
  },
});
