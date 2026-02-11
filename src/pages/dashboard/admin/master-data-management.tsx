"use client"

import { RefreshCcw } from "lucide-react"

import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"

import { useMasterDataManagement } from "@/components/master-data/use-master-data"
import { MasterDataTabs } from "@/components/master-data/master-data-tabs"
import { MasterDataDialogs } from "@/components/master-data/master-data-dialogs"

export default function AdminMasterDataManagementPage() {
    const vm = useMasterDataManagement()

    return (
        <DashboardLayout
            title="Master Data Management"
            subtitle="Maintain core academic records used in scheduling and workload rules."
            actions={
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => void vm.refreshAll()}>
                        <RefreshCcw className="mr-2 h-4 w-4" />
                        Refresh
                    </Button>
                </div>
            }
        >
            <div className="space-y-6 p-6">
                <MasterDataTabs vm={vm} />
                <MasterDataDialogs vm={vm} />
            </div>
        </DashboardLayout>
    )
}
