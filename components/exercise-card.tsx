"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Minus, Plus, GripVertical, X } from "lucide-react"
import type { Exercise } from "@/lib/types"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

interface ExerciseCardProps {
  id: string
  exercise: Exercise
  sets: number
  onSetsChange: (sets: number) => void
  onRemove: () => void
}

export function ExerciseCard({ id, exercise, sets, onSetsChange, onRemove }: ExerciseCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const incrementSets = () => {
    if (sets < 10) onSetsChange(sets + 1)
  }

  const decrementSets = () => {
    if (sets > 1) onSetsChange(sets - 1)
  }

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className="p-3 bg-secondary/50 border-border hover:bg-secondary/70 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
          <GripVertical className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm text-foreground">{exercise.name}</h4>
          <div className="flex flex-wrap gap-1 mt-1">
            {exercise.muscle_weightings.slice(0, 3).map((mw, idx) => (
              <Badge key={idx} variant="outline" className="text-xs">
                {mw.muscle}
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Button onClick={decrementSets} size="icon" variant="outline" className="h-8 w-8 bg-transparent">
            <Minus className="h-3 w-3" />
          </Button>
          <div className="w-12 text-center">
            <span className="text-lg font-bold">{sets}</span>
            <p className="text-xs text-muted-foreground">sets</p>
          </div>
          <Button onClick={incrementSets} size="icon" variant="outline" className="h-8 w-8 bg-transparent">
            <Plus className="h-3 w-3" />
          </Button>
          <Button onClick={onRemove} size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  )
}
