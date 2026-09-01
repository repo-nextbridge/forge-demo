// Root index. The home page is SF-PAGES (out of scope here); V1 serves a minimal landing so the app has
// a root route. It does NOT fetch the port at build or request time.

export default function HomePage() {
  return (
    <main>
      <h1>Forge</h1>
      <p>Storefront-base.</p>
    </main>
  );
}
