/**
 * reCAPTCHA Firebase dans une WebView (SDK Web, OTA).
 * HTML autonome + baseUrl = https://assma-expresse.firebaseapp.com
 * (origine autorisée par Google, sans /__/auth/iframe).
 */
import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import type { ApplicationVerifier } from 'firebase/auth';
import { firebaseWebConfig } from '@/config/firebase';

export type FirebaseRecaptchaVerifierRef = ApplicationVerifier & {
  /** API interne Firebase Auth (appelée après verify()). */
  _reset: () => void;
};

export const RECAPTCHA_CANCELLED_CODE = 'user-cancelled';

export function isRecaptchaCancelled(error: unknown): boolean {
  if (!error) return false;
  const seen = new Set<unknown>();
  const walk = (value: unknown): boolean => {
    if (!value || seen.has(value)) return false;
    if (typeof value === 'object') seen.add(value);
    const code =
      typeof value === 'object' && value && 'code' in value
        ? String((value as { code?: unknown }).code)
        : '';
    const message =
      value instanceof Error
        ? value.message
        : typeof value === 'object' && value && 'message' in value
          ? String((value as { message?: unknown }).message)
          : String(value);
    if (
      code === RECAPTCHA_CANCELLED_CODE ||
      /user-cancelled/i.test(code) ||
      /user-cancelled/i.test(message) ||
      /v[ée]rification annul/i.test(message) ||
      /cancelled|canceled/i.test(message)
    ) {
      return true;
    }
    if (typeof value !== 'object' || value === null) return false;
    const nested = value as {
      cause?: unknown;
      customData?: { originalError?: unknown };
      originalError?: unknown;
    };
    return (
      walk(nested.cause) ||
      walk(nested.originalError) ||
      walk(nested.customData?.originalError)
    );
  };
  return walk(error);
}

export function recaptchaCancelledError(): Error {
  const err = new Error('Vérification annulée') as Error & { code: string };
  err.code = RECAPTCHA_CANCELLED_CODE;
  return err;
}

type RecaptchaMessage =
  | { type: 'verify'; token: string }
  | { type: 'expire' }
  | { type: 'error'; error?: string; raw?: unknown }
  | { type: 'loaded' }
  | { type: 'diag'; source?: string; [key: string]: unknown };

type Props = {
  attemptInvisibleVerification?: boolean;
};

const FIREBASE_JS = '8.10.1';
const AUTH_DOMAIN = 'assma-expresse.firebaseapp.com';
const AUTH_ORIGIN = `https://${AUTH_DOMAIN}`;
const BASE_URL = `${AUTH_ORIGIN}/`;
const RECAPTCHA_API = 'https://www.google.com/recaptcha/api.js?render=explicit';
const WEBVIEW_VISIBLE_STYLE = {
  width: '100%' as const,
  height: 420,
  backgroundColor: 'transparent',
};

function buildRecaptchaHtml(): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <script src="${RECAPTCHA_API}" async defer></script>
  <script src="https://www.gstatic.com/firebasejs/${FIREBASE_JS}/firebase-app.js"></script>
  <script src="https://www.gstatic.com/firebasejs/${FIREBASE_JS}/firebase-auth.js"></script>
  <style>
    html, body { margin: 0; padding: 0; background: #fff; min-height: 100%; }
    #recaptcha-container {
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding: 16px 0 0 0;
      min-height: 78px;
      width: 100%;
    }
  </style>
</head>
<body>
  <div id="recaptcha-container"></div>
</body>
</html>`;
}

function buildInjectedJavaScript(invisible: boolean): string {
  const size = invisible ? 'invisible' : 'normal';
  const autoVerify = invisible
    ? `window.recaptchaVerifier.verify().catch(function(err){post({type:'error',error:String(err&&err.message?err.message:err)});});`
    : '';

  return `
(function(){
  function post(payload){
    try {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }
    } catch (e) {}
  }
  function serializeError(err){
    if (!err) return err;
    if (typeof err !== 'object') return String(err);
    try {
      return { name: err.name, message: err.message, code: err.code, stack: err.stack, string: String(err) };
    } catch (e) { return String(err); }
  }
  if (!window.__a2ConsoleHook) {
    window.__a2ConsoleHook = true;
    ['log','info','warn','error'].forEach(function(level){
      var orig = console[level] ? console[level].bind(console) : function(){};
      console[level] = function(){
        try {
          post({ type: 'diag', source: 'console.' + level, args: Array.prototype.slice.call(arguments).map(function(a){
            return a && typeof a === 'object' ? serializeError(a) : a;
          }) });
        } catch (e) {}
        orig.apply(console, arguments);
      };
    });
  }
  post({
    type: 'diag',
    source: 'injectedJavaScript',
    href: String(location.href),
    readyState: document.readyState,
    grecaptcha: typeof window.grecaptcha,
    grecaptchaReady: !!(window.grecaptcha && window.grecaptcha.render),
    firebase: typeof window.firebase,
    firebaseAuth: !!(window.firebase && firebase.auth),
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    hasContainer: !!document.getElementById('recaptcha-container')
  });
  if (window.__a2RecaptchaBooted) { true; return; }
  window.__a2RecaptchaBooted = true;
  var firebaseConfig = {
    apiKey: ${JSON.stringify(firebaseWebConfig.apiKey)},
    authDomain: ${JSON.stringify(AUTH_DOMAIN)},
    projectId: ${JSON.stringify(firebaseWebConfig.projectId)},
    storageBucket: ${JSON.stringify(firebaseWebConfig.storageBucket)},
    messagingSenderId: ${JSON.stringify(firebaseWebConfig.messagingSenderId)},
    appId: ${JSON.stringify(firebaseWebConfig.appId)}
  };
  function ensureContainer(){
    var el = document.getElementById('recaptcha-container');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'recaptcha-container';
    document.body.insertBefore(el, document.body.firstChild);
    post({ type: 'diag', source: 'container-created' });
    return el;
  }
  function reportGrecaptcha(source){
    var el = document.getElementById('recaptcha-container');
    post({
      type: 'diag',
      source: source,
      href: String(location.href),
      origin: String(location.origin),
      grecaptcha: typeof window.grecaptcha,
      grecaptchaReady: !!(window.grecaptcha && window.grecaptcha.render),
      recaptchaEl: !!el,
      recaptchaChildCount: el ? el.childElementCount : 0,
      recaptchaHtml: el ? String(el.innerHTML).slice(0, 400) : null,
      iframeCount: document.querySelectorAll('iframe').length
    });
  }
  function bootAuth(){
    try {
      ensureContainer();
      reportGrecaptcha('bootAuth:before');
      if (!window.firebase || !firebase.auth) {
        post({ type: 'error', error: 'sdk', raw: { reason: 'firebase-missing' } });
        return;
      }
      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }
      window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
        size: '${size}',
        callback: function(token){ post({type:'verify', token: token}); },
        'expired-callback': function(){ post({type:'expire'}); },
        'error-callback': function(error){
          console.log('[reCAPTCHA Verifier Exception]', error);
          post({type:'error', error:'captcha', raw: serializeError(error)});
        }
      });
      Promise.resolve(window.recaptchaVerifier.render()).then(function(widgetId){
        post({ type: 'diag', source: 'grecaptcha.render', widgetId: widgetId });
        reportGrecaptcha('bootAuth:after-render');
        post({type:'loaded'});
        ${autoVerify}
      }).catch(function(error){
        console.log('[reCAPTCHA Verifier Exception]', error);
        post({
          type: 'error',
          error: String(error && error.message ? error.message : error),
          raw: serializeError(error)
        });
      });
      setTimeout(function(){ reportGrecaptcha('bootAuth:delayed'); }, 1500);
    } catch (error) {
      console.log('[reCAPTCHA Verifier Exception]', error);
      post({
        type: 'error',
        error: String(error && error.message ? error.message : error),
        raw: serializeError(error)
      });
    }
  }
  function start(){
    var grecaptchaOk = !!(window.grecaptcha && window.grecaptcha.render);
    var firebaseOk = !!(window.firebase && firebase.auth);
    post({ type: 'diag', source: 'boot:start', grecaptchaOk: grecaptchaOk, firebaseOk: firebaseOk, size: '${size}' });
    if (firebaseOk && grecaptchaOk) {
      if (window.grecaptcha.ready) window.grecaptcha.ready(bootAuth);
      else bootAuth();
      return;
    }
    post({
      type: 'error',
      error: grecaptchaOk ? 'sdk' : 'grecaptcha-missing',
      raw: { grecaptcha: typeof window.grecaptcha, firebaseOk: firebaseOk }
    });
  }
  start();
  true;
})();
true;
`;
}

export const FirebaseRecaptchaVerifierModal = forwardRef<
  FirebaseRecaptchaVerifierRef,
  Props
>(function FirebaseRecaptchaVerifierModal(
  { attemptInvisibleVerification = true },
  ref,
) {
  const webRef = useRef<WebView>(null);
  const injectedRef = useRef(false);
  const [visible, setVisible] = useState(false);
  const [invisible, setInvisible] = useState(true);
  const [webKey, setWebKey] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const pending = useRef<{
    resolve: (token: string | null) => void;
  } | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanupTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const closeModal = useCallback(() => {
    injectedRef.current = false;
    setVisible(false);
    setLoadError(null);
    setInvisible(true);
  }, []);

  const cancel = useCallback(() => {
    cleanupTimer();
    const waiter = pending.current;
    pending.current = null;
    closeModal();
    // Résoudre (pas reject) pour éviter une « Unhandled promise rejection »
    // si Firebase n’a pas encore attaché son catch.
    waiter?.resolve(null);
  }, [cleanupTimer, closeModal]);

  const succeed = useCallback(
    (token: string) => {
      cleanupTimer();
      const waiter = pending.current;
      pending.current = null;
      closeModal();
      waiter?.resolve(token);
    },
    [cleanupTimer, closeModal],
  );

  const showVisibleChallenge = useCallback(() => {
    cleanupTimer();
    injectedRef.current = false;
    setLoadError(null);
    setInvisible(false);
    setWebKey((k) => k + 1);
  }, [cleanupTimer]);

  useImperativeHandle(
    ref,
    () => ({
      type: 'recaptcha',
      verify: async () => {
        console.log('[reCAPTCHA] verify() appelé', {
          attemptInvisibleVerification,
          authDomain: AUTH_DOMAIN,
          baseUrl: BASE_URL,
        });
        const token = await new Promise<string | null>((resolve) => {
          pending.current = { resolve };
          injectedRef.current = false;
          setLoadError(null);
          setInvisible(false);
          setWebKey((k) => k + 1);
          setVisible(true);
        });
        if (!token) {
          throw recaptchaCancelledError();
        }
        return token;
      },
      _reset: () => {
        injectedRef.current = false;
        webRef.current?.injectJavaScript(`
          (function(){
            try {
              if (window.recaptchaVerifier && typeof window.recaptchaVerifier.clear === 'function') {
                window.recaptchaVerifier.clear();
              }
              window.__a2RecaptchaBooted = false;
            } catch (e) {}
            true;
          })();
          true;
        `);
      },
    }),
    [attemptInvisibleVerification],
  );

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      console.log('[reCAPTCHA Message Received]', event.nativeEvent.data);
      let payload: RecaptchaMessage | null = null;
      try {
        payload = JSON.parse(event.nativeEvent.data) as RecaptchaMessage;
      } catch {
        console.log('[reCAPTCHA] Message non-JSON ignoré');
        return;
      }
      if (!payload?.type) return;
      if (payload.type === 'diag') {
        console.log('[reCAPTCHA JS diag]', payload.source, payload);
        return;
      }
      if (payload.type === 'verify' && payload.token) {
        succeed(payload.token);
        return;
      }
      if (payload.type === 'expire') {
        if (invisible) {
          showVisibleChallenge();
          return;
        }
        setLoadError('La vérification a expiré. Annulez puis renvoyez le code.');
        return;
      }
      if (payload.type === 'loaded') {
        if (!invisible) cleanupTimer();
        return;
      }
      if (payload.type === 'error') {
        console.log('[reCAPTCHA Verifier Exception]', payload.raw ?? payload.error);
        if (invisible) {
          showVisibleChallenge();
          return;
        }
        setLoadError(
          payload.error === 'sdk' || payload.error === 'grecaptcha-missing'
            ? 'Impossible de charger reCAPTCHA. Vérifiez Internet.'
            : 'Cochez la case ci-dessus, ou annulez pour réessayer.',
        );
      }
    },
    [cleanupTimer, invisible, showVisibleChallenge, succeed],
  );

  const onLoadEnd = useCallback(() => {
    console.log('[reCAPTCHA] Finished loading WebView', { baseUrl: BASE_URL, invisible });
  }, [invisible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={cancel}
    >
      <View style={styles.overlay}>
        <View style={[styles.card, invisible ? styles.cardCompact : styles.cardVisible]}>
          <Text style={styles.title}>
            {invisible ? 'Vérification…' : 'Vérification de sécurité'}
          </Text>
          <Text style={styles.subtitle}>
            {invisible
              ? 'Contrôle anti-robot en cours'
              : 'Cochez « Je ne suis pas un robot » pour recevoir le SMS'}
          </Text>
          <View style={invisible ? styles.webWrapHidden : styles.webWrap}>
            {visible ? (
              <WebView
                key={webKey}
                ref={webRef}
                source={{
                  html: buildRecaptchaHtml(),
                  baseUrl: BASE_URL,
                }}
                injectedJavaScript={buildInjectedJavaScript(invisible)}
                onLoadStart={() => console.log('[reCAPTCHA] Start loading HTML/URL')}
                onLoadEnd={onLoadEnd}
                onMessage={onMessage}
                onError={(syntheticEvent) =>
                  console.log('[reCAPTCHA WebView Error]', syntheticEvent.nativeEvent)
                }
                onHttpError={(syntheticEvent) =>
                  console.log('[reCAPTCHA HTTP Error]', syntheticEvent.nativeEvent)
                }
                javaScriptEnabled={true}
                domStorageEnabled={true}
                originWhitelist={['*']}
                mixedContentMode="always"
                thirdPartyCookiesEnabled
                sharedCookiesEnabled
                androidHardwareAccelerationDisabled={Platform.OS === 'android'}
                automaticallyAdjustContentInsets={false}
                nestedScrollEnabled={!invisible}
                scrollEnabled={!invisible}
                style={invisible ? styles.webviewHidden : WEBVIEW_VISIBLE_STYLE}
              />
            ) : null}
          </View>
          {invisible ? <ActivityIndicator color="#FF6B00" style={styles.spinner} /> : null}
          {loadError && !invisible ? <Text style={styles.errorText}>{loadError}</Text> : null}
          <Pressable style={styles.cancel} onPress={cancel}>
            <Text style={styles.cancelText}>Annuler</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 24,
  },
  card: {
    width: '100%',
    backgroundColor: '#FFF',
    borderRadius: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  cardCompact: {
    minHeight: 160,
  },
  cardVisible: {
    maxHeight: '92%',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 8,
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  webWrap: {
    width: '100%',
    height: 420,
    backgroundColor: 'transparent',
  },
  webWrapHidden: {
    height: 1,
    width: 1,
    opacity: 0.01,
    overflow: 'hidden',
  },
  webviewHidden: {
    width: 1,
    height: 1,
    backgroundColor: 'transparent',
  },
  spinner: {
    marginVertical: 16,
  },
  errorText: {
    color: '#C62828',
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 16,
    marginTop: 4,
  },
  cancel: {
    alignSelf: 'center',
    paddingVertical: 12,
  },
  cancelText: {
    color: '#FF6B00',
    fontWeight: '600',
    fontSize: 15,
  },
});
