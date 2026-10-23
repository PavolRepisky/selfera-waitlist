import { createClient } from '@supabase/supabase-js';
import { startDepthScene } from './depth';
import { startMetal } from './metal';

type Joined = { place: number; code: string; total: number; already: boolean };

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const supabase = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const form = $<HTMLFormElement>('join');
const email = $<HTMLInputElement>('email');
const submit = $<HTMLButtonElement>('submit');
const status = $<HTMLParagraphElement>('status');
const done = $<HTMLDivElement>('done');
const link = $<HTMLInputElement>('link');
const copy = $<HTMLButtonElement>('copy');
const share = $<HTMLButtonElement>('share');

startDepthScene($<HTMLCanvasElement>('scene'), $('stage'), '/scene/scene.jpg', '/scene/depth.jpg');
startMetal($<HTMLCanvasElement>('metal'), '/logo-mask.png');

// A friend's invite code rides in on ?ref= and is kept for the visit, so it
// still counts if they look around before signing up.
const params = new URLSearchParams(location.search);
const ref = params.get('ref') ?? sessionStorageGet('ref');
if (params.get('ref')) sessionStorageSet('ref', params.get('ref')!);
const source = params.get('utm_source') ?? (document.referrer ? new URL(document.referrer).hostname : null);

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const INVITE = 'Start an era with me? On Selfera we photograph our habits every day, so neither of us quits. Get on the waitlist:';
const SUBMIT = 'Get early access';

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  submit.classList.remove('error');
  const value = email.value.trim();
  if (!EMAIL.test(value)) {
    say('That email doesn’t look right.');
    email.focus();
    return;
  }

  submit.disabled = true;
  submit.textContent = 'Saving…';
  say('');
  try {
    show(await join(value));
  } catch (error) {
    console.error(error);
    submit.classList.add('error');
    submit.textContent = 'Something went wrong';
  } finally {
    submit.disabled = false;
    if (!submit.classList.contains('error')) submit.textContent = SUBMIT;
  }
});
email.addEventListener('input', () => {
  if (!submit.classList.contains('error')) return;
  submit.classList.remove('error');
  submit.textContent = SUBMIT;
});

copy.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(link.value);
  } catch {
    link.select();
    document.execCommand('copy');
  }
  copy.textContent = 'Copied';
  setTimeout(() => (copy.textContent = 'Copy'), 1600);
});

// The phone's own share sheet, which already lists WhatsApp, Messages and the
// rest; where there is none, the link and Copy are enough.
if (typeof navigator.share === 'function') share.hidden = false;
share.addEventListener('click', () => {
  navigator.share({ title: 'Selfera', text: INVITE, url: link.value }).catch(() => {});
});

async function join(value: string): Promise<Joined> {
  if (!supabase) {
    // Without a project the page still runs for layout work, but only in dev
    // — a build with no keys should fail loudly rather than pretend.
    if (import.meta.env.DEV) {
      console.warn('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set — faking the sign-up.');
      return { place: 128, code: 'devcode1', total: 128, already: false };
    }
    throw new Error('Supabase is not configured');
  }
  const { data, error } = await supabase
    .rpc('join_waitlist', { p_email: value, p_ref: ref, p_source: source })
    .single<Joined>();
  if (error) throw error;
  return data;
}

function show({ place, code, already }: Joined) {
  const base = (import.meta.env.VITE_SITE_URL as string | undefined) || location.origin;
  link.value = `${base.replace(/\/$/, '')}/?ref=${code}`;
  $('place').textContent = `#${place.toLocaleString()}`;
  // Once in, the card is about the place and the link: the pitch and the
  // count step aside, since the place already says where you stand.
  document.querySelector('.card')!.classList.add('joined');
  document.querySelector('h1')!.textContent = 'You’re on the list.';
  form.hidden = true;
  done.hidden = false;
  done.classList.add('pop');
  say(already ? 'You were already on the list.' : '');
}

function say(message: string) {
  status.textContent = message;
}

// Storage can throw in private windows; the referral is a nicety, not a must.
function sessionStorageGet(name: string) {
  try {
    return sessionStorage.getItem(name);
  } catch {
    return null;
  }
}
function sessionStorageSet(name: string, value: string) {
  try {
    sessionStorage.setItem(name, value);
  } catch {}
}

