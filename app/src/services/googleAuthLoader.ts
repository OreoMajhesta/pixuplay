// Lazy loader for Google Identity Services script
// Prevents downloading GSI script and 11 third-party tracking cookies on initial page load
let gsiPromise: Promise<void> | null = null;

export function loadGoogleGsiScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.google?.accounts?.id) return Promise.resolve();

  if (!gsiPromise) {
    gsiPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = (err) => reject(err);
      document.head.appendChild(script);
    });
  }

  return gsiPromise;
}
