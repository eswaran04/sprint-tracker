import { GoalGenerator, GoalTabLabel } from "@/components/import/goal-generator";
import { ImportWizard } from "@/components/import/import-wizard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ImportPage() {
  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">New sprint</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Describe your goal and we&apos;ll build a plan from public sheets, or upload your own sheet (parsed in the browser).
      </p>
      <Tabs defaultValue="goal" className="gap-6">
        <TabsList>
          <TabsTrigger value="goal"><GoalTabLabel /></TabsTrigger>
          <TabsTrigger value="file">Upload file</TabsTrigger>
        </TabsList>
        <TabsContent value="goal">
          <GoalGenerator />
        </TabsContent>
        <TabsContent value="file">
          <ImportWizard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
