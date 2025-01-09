import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useParams } from "react-router-dom";
import { Separator } from "@/components/ui/separator";
import { Rules, WorkerMessageEvent } from '@/utils/interfaces';
import { sidebarNavItems } from '@/utils/constants';
import { EditRuleForm } from '@/components/features/rule-form/EditRuleForm';

import { SidebarNav } from '@/components/layout/sidebar-nav';
import DocumentsPage from './documents/page';
import RulesPage from './rules/page';
import GeneralSettingsPage from './general-settings/page';

import '@/App.css';

/**
 * Renders the settings page.
 * @category Component
 */
const Settings = () => {
    const location = useLocation();
    const { ruleId } = useParams();
    
    const getPageContent = () => {
        const path = location.pathname;
        
        if (path === "/settings/general") {
            return <GeneralSettingsPage />;
        }
        
        if (path === "/settings/documents") {
            return <DocumentsPage />;
        }
        
        // Rules section handling
        if (path.startsWith("/settings/rules")) {
            if (path === "/settings/rules/new") {
                return <RulesPage id="new" />;
            }
            if (ruleId) {
                return <RulesPage id={ruleId} />;
            }
            return <RulesPage />;
        }
        
        return <DocumentsPage />;
    };

    return (
        <div className="space-y-6 p-5 pb-16 md:block md:p-10">
            <div className="space-y-0.5">
                <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
                <p className="text-muted-foreground">
                    Manage your documents and rules preferences.
                </p>
            </div>
            <Separator className="my-6" />
            <div className="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
                <aside className="-mx-4 lg:w-1/5 lg:sticky lg:top-0 pl-2">
                    <SidebarNav items={sidebarNavItems} />
                </aside>
                <main className="flex-1 lg:max-w-2xl w-full">
                    {getPageContent()}
                </main>
            </div>
        </div>
    );
};

export default Settings;
