import { ThemeProvider } from "@/components/theme-provider";
import { createBrowserRouter, createRoutesFromElements, Route, RouterProvider } from 'react-router-dom';
import Header from '@/components/Header';
import Home from '@/pages/Home';
import Settings from '@/pages/Settings';
import ErrorPage from "@/error-page";

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route path="/" element={<Header />} errorElement={<ErrorPage />}>
      <Route index element={<Home />} errorElement={<ErrorPage />}/>
      <Route path="/settings/*" element={<Settings />} errorElement={<ErrorPage />}/>
      <Route path="/settings/rules/:ruleId" element={<Settings />} errorElement={<ErrorPage />}/>
      <Route path="*" element={<div>Not found</div>} errorElement={<ErrorPage />}/>
    </Route>
  )
)

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <RouterProvider router={router}/>
    </ThemeProvider>
  );
}

export default App;