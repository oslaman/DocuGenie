import { ThemeProvider } from "@/components/theme-provider";
import { createBrowserRouter, createRoutesFromElements, Route, RouterProvider } from 'react-router-dom';
import Header from '@/components/Header';
import Home from '@/pages/Home';
import Settings from '@/pages/Settings';

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route path="/" element={<Header />}>
      <Route index element={<Home />} />
      <Route path="settings" element={<Settings />} />
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