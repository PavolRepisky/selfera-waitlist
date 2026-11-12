// The page a shared link shows without the app. The path says what was
// shared; the words follow it, and Open in Selfera hands the same path to the
// app by its own scheme, for when it's installed but the link was opened
// where the phone doesn't pass links to apps (a link inside Instagram, or
// one typed into the browser).

// The app's store pages. The App Store's id only exists once the listing is
// made, so until then this is the same search the app's update screen uses
// (mobile-app/lib/appVersion.ts).
const APP_STORE = 'https://apps.apple.com/search?term=selfera';
const PLAY_STORE = 'https://play.google.com/store/apps/details?id=app.selfera';

const [, kind, raw = ''] = location.pathname.split('/');
const value = decodeURIComponent(raw);

const title = document.getElementById('title')!;
const lede = document.getElementById('lede')!;
const openApp = document.getElementById('open') as HTMLAnchorElement;

if (kind === 'u' && value) {
  title.textContent = `@${value} is on Selfera`;
  lede.textContent = 'Get the app to see their days and add them as a friend.';
  document.title = `@${value} on Selfera`;
  openApp.href = `selfera://u/${encodeURIComponent(value)}`;
} else if (kind === 'era' && value) {
  title.textContent = "You're invited to an era";
  lede.textContent = 'Get the app to see its tasks and join. Each day you photograph them, and your friends see your day.';
  document.title = 'An era on Selfera';
  openApp.href = `selfera://era/${encodeURIComponent(value)}`;
}

(document.getElementById('app-store') as HTMLAnchorElement).href = APP_STORE;
(document.getElementById('play-store') as HTMLAnchorElement).href = PLAY_STORE;

// Only the store for the phone in hand, where it can be told; a computer
// sees both.
const ua = navigator.userAgent;
if (/iPhone|iPad|iPod/.test(ua)) document.getElementById('play-store')!.hidden = true;
else if (/Android/.test(ua)) document.getElementById('app-store')!.hidden = true;
