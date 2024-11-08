import { useState, useEffect, useRef } from 'react'
import { Trash2, AlertTriangle, Database, RefreshCw, Table as TableIcon } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"

import { getTotalChunks } from '@/utils/db/db-documents'
import { getTotalRules } from '@/utils/db/db-rules'
import { getDB, getDbSizeInBytes } from '@/utils/db/db-helper'
import { formatBytes } from '@/utils/helpers'
import { toast } from 'sonner'

import { clearTable, clearDb } from '@/utils/db/db-helper'

type TableName = 'chunks' | 'rules' | ''

/**
 * Renders the general settings page.
 * @category Component
 */
export default function GeneralSettingsPage() {
    /** The selected table for deletion. */
    const [selectedTable, setSelectedTable] = useState<TableName>('chunks')
    /** The size of the database. */
    const [dbSize, setDbSize] = useState<string>('0 B')
    /** The counts of the tables. */
    const [tableCounts, setTableCounts] = useState({
        chunks: 0,
        rules: 0,
    })
    /** The database instance. */
    const db = useRef<any>(null);

    /** Fetches the data from the database. */
    const fetchData = async () => {
        if (!db.current) {
            db.current = await getDB()
        }

        const chunksCount = await getTotalChunks(db.current)
        const rulesCount = await getTotalRules(db.current)
        setTableCounts({
            chunks: chunksCount,
            rules: rulesCount,
        })
    }

    /** Fetches the size of the database. */    
    const fetchDbSize = async () => {
        if (!db.current) {
            db.current = await getDB()
        }

        const dbSize = await getDbSizeInBytes(db.current)
        setDbSize(formatBytes(dbSize))
    }

    /** Initializes the database instance. */
    useEffect(() => {
        const fetchDb = async () => {
            db.current = await getDB()
        }
        fetchDb()
    }, [])

    /** Fetches the data from the database. */
    useEffect(() => {
        fetchData()
    }, [tableCounts])

    /** Fetches the size of the database. */
    useEffect(() => {
        fetchDbSize()
    }, [dbSize])

    /** Deletes a table from the database. */
    const deleteTable = async () => {
        if (!db.current) {
            db.current = await getDB()
        }

        if (selectedTable) {
            if (confirm(`Are you sure you want to clear the "${selectedTable}" table? This action cannot be undone.`)) {
                try {
                    await clearTable(db.current, selectedTable).then(() => {
                        setSelectedTable('')
                        toast.success(`Table "${selectedTable}" cleared.`)
                    })
                } catch (error) {
                    toast.error(`Error clearing table "${selectedTable}".`)
                }
            }
        }
    }

    /** Deletes all tables from the database. */
    const removeAllTables = async () => {
        if (!db.current) {
            db.current = await getDB()
        }

        if (confirm('Are you sure you want to clear all tables? This action cannot be undone.')) {
            try {
                await clearDb(db.current).then(() => {
                    toast.success('All tables cleared.')
                    fetchData()
                })
            } catch (error) {
                toast.error('Error clearing tables.')
            }
        }
    }

    /** Deletes the entire database. */
    const deleteDatabase = () => {
        if (confirm('Are you absolutely sure you want to delete the entire database? This action is irreversible!')) {

        }
    }

    /** Refreshes the data from the database. */
    const refreshData = () => {
        fetchData()
        fetchDbSize()
        toast("Database details refreshed.", {
            description: new Date().toLocaleString(),
        })
    }

    return (
        <div className='space-y-6'>
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbPage>Settings</BreadcrumbPage>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>General</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <h3 className="text-lg font-medium">General</h3>
            <p className="text-sm text-muted-foreground">
                General settings for DocuGenie.
            </p>
            <Separator />
            <div className="container mx-auto space-y-8">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-2xl font-bold">Database Details</CardTitle>
                        <CardDescription>Overview of your database structure and content</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Alert>
                            <Database className="h-4 w-4" />
                            <AlertTitle>Database Size</AlertTitle>
                            <AlertDescription>{dbSize}</AlertDescription>
                        </Alert>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {Object.entries(tableCounts).map(([tableName, count]) => (
                                <Card key={tableName}>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-lg font-semibold">{tableName.charAt(0).toUpperCase() + tableName.slice(1)}</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex items-center space-x-2">
                                            <TableIcon className="h-4 w-4 text-muted-foreground" />
                                            <span className="text-2xl font-bold">{count.toLocaleString()}</span>
                                            <span className="text-muted-foreground">rows</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button variant="outline" onClick={refreshData}>
                            <RefreshCw className="mr-2 h-4 w-4" /> Refresh Data
                        </Button>
                    </CardFooter>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-2xl font-bold text-red-600">Danger Zone</CardTitle>
                        <CardDescription>Be extremely careful with these actions. They can cause irreversible data loss.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 flex flex-col">
                        <div className="flex items-center space-x-4">
                            <Select value={selectedTable} onValueChange={(value) => setSelectedTable(value as TableName)}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Select table" />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(tableCounts).map(([tableName, count]) => (
                                        <SelectItem key={tableName} value={tableName}>{tableName.charAt(0).toUpperCase() + tableName.slice(1)}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button variant="destructive" onClick={deleteTable} disabled={!selectedTable}>
                                <Trash2 className="mr-2 h-4 w-4" /> Clear Table
                            </Button>
                        </div>
                        <Button variant="destructive" onClick={removeAllTables} className="w-fit">
                            <AlertTriangle className="mr-2 h-4 w-4" /> Clear All Tables
                        </Button>
                        {/* <Button variant="destructive" onClick={deleteDatabase} className="w-fit">
                            <Database className="mr-2 h-4 w-4" /> Delete Entire Database
                        </Button> */}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}