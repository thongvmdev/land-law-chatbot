"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FC } from "react";

const MODELS = [
  { name: "Land Law Assistant", value: "default" },
] as const;

export const ModelPicker: FC = () => {
  return (
    <Select defaultValue={MODELS[0].value}>
      <SelectTrigger className="h-9 w-auto gap-2 border-none bg-transparent px-2 shadow-none hover:bg-muted focus:ring-0">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {MODELS.map((model) => (
          <SelectItem key={model.value} value={model.value}>
            <span className="flex items-center gap-2">
              <span>{model.name}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

