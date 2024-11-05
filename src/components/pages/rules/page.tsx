import { Separator } from "@/components/ui/separator";
import RulesForm from "./rules-form";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

import { EditRuleForm } from "@/components/features/rule-form/EditRuleForm";

interface RulesPageProps {
    id?: string;
}

export default function RulesPage({ id }: RulesPageProps) {
    return (
        <div className="space-y-6">
                <Breadcrumb>
                    <BreadcrumbList>
                        <BreadcrumbItem>
                            <BreadcrumbPage>Settings</BreadcrumbPage>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            {id ? (
                                <BreadcrumbLink href={`/settings/rules`}>Rules</BreadcrumbLink>
                            ) : (
                                <BreadcrumbPage>Rules</BreadcrumbPage>
                            )}
                        </BreadcrumbItem>
                        {id && (
                            <>
                                <BreadcrumbSeparator />
                                <BreadcrumbItem>
                                    <BreadcrumbPage>{`Rule ${id}`}</BreadcrumbPage>
                                </BreadcrumbItem>
                            </>
                        )}
                    </BreadcrumbList>
                </Breadcrumb>

                <h3 className="text-lg font-medium">{id ? `Edit rule ${id}` : "Rules"}</h3>
                <p className="text-sm text-muted-foreground">
                    Update your rule settings.
                </p>
            <Separator />
            {id ? <EditRuleForm /> : <RulesForm />}
        </div>
    );
}