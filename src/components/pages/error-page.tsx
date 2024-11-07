import { useRouteError } from "react-router-dom";

/**
 * Renders the error page.
 * @category Component
 */
export default function ErrorPage() {
  const error = useRouteError() as { statusText: string, message: string };
  console.error(error);

  return (
    <div id="error-page">
      <h1>Error</h1>
      <p>Sorry, an unexpected error has occurred.</p>
      <p>
        <i>{error.statusText || error.message}</i>
      </p>
    </div>
  );
}