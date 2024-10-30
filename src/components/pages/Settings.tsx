import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from "react-router-dom";
import { Separator } from "@/components/ui/separator";
import { Rules, WorkerMessageEvent } from '@/utils/interfaces';
import { sidebarNavItems } from '@/utils/constants';
import { EditRuleForm } from '@/components/features/rule-form/EditRuleForm';

import { SidebarNav } from '@/components/layout/sidebar-nav';
import DocumentsPage from './documents/page';
import RulesPage from './rules/page';
import { useParams } from 'react-router-dom';

import '@/App.css';

const Settings = () => {
    const location = useLocation();
    const { ruleId } = useParams();

    return (
        <div className="hidden space-y-6 p-10 pb-16 md:block">
            <div className="space-y-0.5">
                <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
                <p className="text-muted-foreground">
                    Manage your documents and rules preferences.
                </p>
            </div>
            <Separator className="my-6" />
            <div className="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
                <aside className="-mx-4 lg:w-1/5 lg:sticky lg:top-0">
                    <SidebarNav items={sidebarNavItems} />
                </aside>
                <main className="flex-1 lg:max-w-2xl">
                    {location.pathname === "/settings/documents" && (
                        <DocumentsPage />
                    )}
                    {location.pathname === "/settings/rules" && (
                        <RulesPage />
                    )}
                    {location.pathname === `/settings/rules/${ruleId}` && (
                        <EditRuleForm />
                    )}
                </main>
            </div>
        </div>
    );
};

export default Settings;
