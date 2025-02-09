import { Separator } from "@/components/ui/separator";
import DocumentForm from "./document-form";

import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"


/**
 * Renders the page for managing documents.
 * @category Component
 */
export default function DocumentsPage() {
    return (
        <div className="space-y-6">
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbPage>Settings</BreadcrumbPage>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>Documents</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <h3 className="text-lg font-medium">Documents</h3>
            <p className="text-sm text-muted-foreground">
                Update your documents settings.
            </p>
            <Separator />
            <DocumentForm />
        </div>
    );
}