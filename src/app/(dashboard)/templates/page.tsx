"use client";

import { useState, useMemo } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TemplateCard } from "@/components/dashboard/template-card";
import { TemplateDetailModal } from "@/components/dashboard/template-detail-modal";
import {
  TEMPLATES,
  CATEGORY_LABELS,
  type AgentTemplate,
  type TemplateCategory,
} from "@/lib/data/templates";

type FilterCategory = TemplateCategory | "all";

export default function TemplatesPage() {
  const [selectedCategory, setSelectedCategory] = useState<FilterCategory>("all");
  const [selectedTemplate, setSelectedTemplate] = useState<AgentTemplate | null>(
    null
  );
  const [modalOpen, setModalOpen] = useState(false);

  const filteredTemplates = useMemo(() => {
    if (selectedCategory === "all") return TEMPLATES;
    return TEMPLATES.filter((t) => t.category === selectedCategory);
  }, [selectedCategory]);

  const handleSelectTemplate = (template: AgentTemplate) => {
    setSelectedTemplate(template);
    setModalOpen(true);
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Templates"
        description="Start with pre-built agent configurations for common use cases"
      />

      <Tabs
        defaultValue="all"
        value={selectedCategory}
        onValueChange={(v) => setSelectedCategory(v as FilterCategory)}
      >
        <TabsList variant="line" className="mb-6">
          {(Object.keys(CATEGORY_LABELS) as FilterCategory[]).map((category) => (
            <TabsTrigger key={category} value={category}>
              {CATEGORY_LABELS[category]}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={selectedCategory} className="mt-0">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onSelect={handleSelectTemplate}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <TemplateDetailModal
        template={selectedTemplate}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </div>
  );
}
