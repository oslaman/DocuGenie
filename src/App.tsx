import { ThemeProvider } from "@/components/theme-provider";
import { createBrowserRouter, createRoutesFromElements, Route, RouterProvider } from 'react-router-dom';
import Header from '@/components/layout/Header';
import Home from '@/components/pages/Home';
import Settings from '@/components/pages/Settings';
import ErrorPage from "@/components/pages/error-page";
import { Toaster } from "@/components/ui/sonner";

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
      <Toaster />
    </ThemeProvider>
  );
}

export default App;