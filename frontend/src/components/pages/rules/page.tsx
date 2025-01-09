import { Separator } from "@/components/ui/separator";
import { RuleForm } from "@/components/features/rule-form/RuleForm";
import { EditRuleForm } from "@/components/features/rule-form/EditRuleForm";
import { RulesDashboard } from "./rules-dashboard";
import { RulesContext } from "@/context/context";
import { useState } from "react";
import { Rules } from "@/utils/interfaces";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

interface RulesPageProps {
    id?: string;
}

export default function RulesPage({ id }: RulesPageProps) {
    const [rules, setRules] = useState<Rules[]>([]);
    const isNew = id === 'new';
    const pageTitle = isNew ? "New Rule" : id ? `Edit Rule ${id}` : "Rules";
    const description = isNew ? "Create a new rule" : id ? "Update your rule settings" : "Manage your rules";

    return (
        <div className="space-y-6">
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/settings">Settings</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        {id ? (
                            <BreadcrumbLink href="/settings/rules">Rules</BreadcrumbLink>
                        ) : (
                            <BreadcrumbPage>Rules</BreadcrumbPage>
                        )}
                    </BreadcrumbItem>
                    {id && (
                        <>
                            <BreadcrumbSeparator />
                            <BreadcrumbItem>
                                <BreadcrumbPage>{isNew ? "New Rule" : `Rule ${id}`}</BreadcrumbPage>
                            </BreadcrumbItem>
                        </>
                    )}
                </BreadcrumbList>
            </Breadcrumb>

            <div>
                <h3 className="text-lg font-medium">{pageTitle}</h3>
                <p className="text-sm text-muted-foreground">
                    {description}
                </p>
            </div>
            <Separator />
            <RulesContext.Provider value={{ rules, setRules }}>
                {isNew ? (
                    <RuleForm />
                ) : id ? (
                    <EditRuleForm />
                ) : (
                    <RulesDashboard />
                )}
            </RulesContext.Provider>
        </div>
    );
}