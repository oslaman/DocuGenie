import { Separator } from "@/components/ui/separator";
import DocumentForm from "./document-form";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"


export default function DocumentsPage() {
    return (
        <>
            <div className="space-y-6">
                <div>
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
                </div>
                <Separator />
                <DocumentForm />
            </div>
        </>
    );
}