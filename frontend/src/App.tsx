import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Settings from '@/components/pages/Settings';
import DocumentsPage from '@/components/pages/documents/page';
import GeneralSettingsPage from '@/components/pages/general-settings/page';
import { ThemeProvider } from "@/components/theme-provider";
import { createBrowserRouter, createRoutesFromElements, RouterProvider } from 'react-router-dom';
import Header from '@/components/layout/Header';
import Home from '@/components/pages/Home';
import ErrorPage from "@/components/pages/error-page";
import { Toaster } from "@/components/ui/sonner";

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route path="/" element={<Header />} errorElement={<ErrorPage />}>
      <Route index element={<Home />} errorElement={<ErrorPage />}/>
      <Route path="settings" element={<Settings />} errorElement={<ErrorPage />}>
        <Route path="general" element={<GeneralSettingsPage />} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="rules">
          <Route index element={<Settings />} />
          <Route path="new" element={<Settings />} />
          <Route path=":ruleId" element={<Settings />} />
        </Route>
      </Route>
      <Route path="*" element={<div>Page not found</div>} errorElement={<ErrorPage />}/>
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