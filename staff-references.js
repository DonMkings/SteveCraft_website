import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './supabase-config.js';

const $ = (id) => document.getElementById(id);
const BUCKET = 'design-references';
const URL_LIFETIME_SECONDS = 300;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_FILE = /^[1-3]\.(jpg|png|webp)$/i;
const client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
});

let authorizedUserId = null;
let requestId = 0;

function status(message, error = false) {
  $('status').textContent = message;
  $('status').classList.toggle('error', error);
}
function clearPhotos() {
  $('photo-results').replaceChildren();
  requestId++;
}
function showSignIn() {
  authorizedUserId = null;
  clearPhotos();
  $('login-panel').hidden = false;
  $('viewer-panel').hidden = true;
  $('signed-in-as').textContent = '';
}
function showViewer(email) {
  $('login-panel').hidden = true;
  $('viewer-panel').hidden = false;
  $('signed-in-as').textContent = email || 'Authenticated staff';
}
async function verifyStaff() {
  const thisRequest = ++requestId;
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (thisRequest !== requestId) return;
  if (authError || !user) {
    showSignIn();
    status('Sign in with your authorized SteveCraft admin account.');
    return;
  }
  const { data: isAdmin, error } = await client.rpc('is_shop_admin');
  if (thisRequest !== requestId) return;
  if (error || isAdmin !== true) {
    showSignIn();
    status('This account does not have permission to view customer photographs.', true);
    return;
  }
  authorizedUserId = user.id;
  showViewer(user.email);
  status('Signed in. Enter a Reference ID from the customer’s quote.');
}

$('password-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  status('Signing in…');
  const email = $('staff-email').value.trim();
  const password = $('staff-password').value;
  const { error } = await client.auth.signInWithPassword({ email, password });
  $('staff-password').value = '';
  if (error) {
    status('Could not sign in. Check your credentials and try again.', true);
    return;
  }
  await verifyStaff();
});

$('email-link').addEventListener('click', async () => {
  const email = $('staff-email').value.trim();
  if (!$('staff-email').checkValidity()) {
    $('staff-email').reportValidity();
    return;
  }
  status('Requesting a sign-in email…');
  const { error } = await client.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: new URL('staff-references.html', location.href).href },
  });
  status(error ? 'Could not request an email link. Try the password method.' : 'If this account is eligible, check its email for a sign-in link.', !!error);
});

$('sign-out').addEventListener('click', async () => {
  clearPhotos();
  await client.auth.signOut();
  showSignIn();
  status('Signed out.');
});

$('reference-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  clearPhotos();
  const activeRequest = requestId;
  const referenceId = $('reference-id').value.trim().toLowerCase();
  if (!UUID.test(referenceId)) {
    status('Enter the full Reference ID from the WhatsApp message.', true);
    return;
  }
  if (!authorizedUserId) {
    showSignIn();
    status('Staff authentication required.', true);
    return;
  }
  status('Looking up photos securely…');

  // Supabase Storage RLS permits listing and signed links only to authenticated
  // accounts in shop_admins. No service role credentials are used in this page.
  const { data: files, error } = await client.storage.from(BUCKET).list(referenceId, {
    limit: 10,
    offset: 0,
    sortBy: { column: 'name', order: 'asc' },
  });
  if (activeRequest !== requestId) return;
  if (error) {
    status('Could not access private images. Verify you are still authorized.', true);
    return;
  }
  const validFiles = (files || []).filter(file =>
    ALLOWED_FILE.test(file.name) && file.id && !file.name.includes('/'));
  if (!validFiles.length) {
    status('No photographs were found for that Reference ID. Check the ID or whether the images have expired.', true);
    return;
  }

  const paths = validFiles.slice(0, 3).map(file => referenceId + '/' + file.name);
  const { data: signed, error: signError } = await client.storage.from(BUCKET)
    .createSignedUrls(paths, URL_LIFETIME_SECONDS);
  if (activeRequest !== requestId) return;
  if (signError || !signed || signed.some(item => item.error || !item.signedUrl)) {
    status('Could not create temporary image links. Please try again.', true);
    return;
  }

  const fragment = document.createDocumentFragment();
  signed.forEach((item, index) => {
    const figure = document.createElement('figure');
    figure.className = 'photo';
    const img = document.createElement('img');
    img.src = item.signedUrl;
    img.alt = 'Private customer reference photo ' + (index + 1);
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    const caption = document.createElement('figcaption');
    const filename = document.createElement('span');
    filename.textContent = paths[index].split('/')[1];
    const open = document.createElement('a');
    open.href = item.signedUrl;
    open.target = '_blank';
    open.rel = 'noopener noreferrer';
    open.textContent = 'Open image ↗';
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'secondary';
    copy.textContent = 'Copy 5-minute link';
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(item.signedUrl);
        copy.textContent = 'Copied';
      } catch {
        status('Clipboard access unavailable. Use “Open image” instead.', true);
      }
    });
    caption.append(filename, open, copy);
    figure.append(img, caption);
    fragment.append(figure);
  });
  $('photo-results').replaceChildren(fragment);
  status('Found ' + signed.length + ' private photo(s). Links expire in 5 minutes.');
});

client.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') {
    showSignIn();
    status('Signed out.');
  }
  // Do not await Supabase calls inside this listener.
});
verifyStaff().catch(() => {
  showSignIn();
  status('Unable to connect to staff authentication. Try again later.', true);
});
