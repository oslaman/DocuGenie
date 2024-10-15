import React, { useState, useRef, useEffect, useCallback } from 'react';
import { getDB, initSchema, countRows, seedDb, seedSingleDb, search, clearDb, getDbData } from './utils/db';
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { InputDialogue } from "@/components/InputDialogue";
import { ThemeProvider } from "@/components/theme-provider";
import { ModeToggle } from "@/components/mode-toggle";
import { Progress } from "@/components/ui/progress";
import { recursiveChunkingWithPages, TextWithPage } from './utils/chunking';
import { createBrowserRouter, createRoutesFromElements, Route, RouterProvider } from 'react-router-dom';
import Header from '@/components/Header';
import Home from '@/pages/Home';
import Settings from '@/pages/Settings';

import './App.css';

interface WorkerMessageEvent extends MessageEvent {
  data: {
    status: string;
    embedding?: any;
    output?: { content: string };
  };
}

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