"use client"

import { useState, useMemo } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search } from "lucide-react"
import { useExercises } from "@/lib/exercise-context"

interface ExerciseLibraryModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectExercise: (exerciseId: string) => void
}

const ALL_EQUIPMENT = "all"

const formatEquipment = (equipment: string) =>
  equipment === "none" ? "Bodyweight" : equipment.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())

export function ExerciseLibraryModal({ open, onOpenChange, onSelectExercise }: ExerciseLibraryModalProps) {
  const { exercises } = useExercises()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null)
  const [selectedEquipment, setSelectedEquipment] = useState(ALL_EQUIPMENT)

  const allMuscles = useMemo(() => {
    const muscles = new Set<string>()
    exercises.forEach((ex) => {
      ex.muscle_weightings.forEach((mw) => muscles.add(mw.muscle))
    })
    return Array.from(muscles).sort()
  }, [exercises])

  const allEquipment = useMemo(
    () => Array.from(new Set(exercises.flatMap((ex) => (ex.equipment ? [ex.equipment] : [])))).sort(),
    [exercises],
  )

  const filteredExercises = useMemo(() => {
    const words = searchQuery.toLowerCase().split(/\s+/).filter(Boolean)
    return exercises.filter((ex) => {
      // Legacy exercises only exist so old routines keep working.
      if (ex.legacy) return false
      const name = ex.name.toLowerCase()
      const matchesSearch = words.every((word) => name.includes(word))
      // Only the main muscle counts, so "Chest" doesn't list every triceps exercise.
      const matchesMuscle = !selectedMuscle || ex.muscle_weightings[0]?.muscle === selectedMuscle
      const matchesEquipment = selectedEquipment === ALL_EQUIPMENT || ex.equipment === selectedEquipment
      return matchesSearch && matchesMuscle && matchesEquipment
    })
  }, [exercises, searchQuery, selectedMuscle, selectedEquipment])

  const handleSelect = (exerciseId: string) => {
    onSelectExercise(exerciseId)
    onOpenChange(false)
    setSearchQuery("")
    setSelectedMuscle(null)
    setSelectedEquipment(ALL_EQUIPMENT)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Exercise Library</DialogTitle>
          <DialogDescription>Search and filter exercises to add to your routine</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search and equipment */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search exercises..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={selectedEquipment} onValueChange={setSelectedEquipment}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_EQUIPMENT}>All equipment</SelectItem>
                {allEquipment.map((equipment) => (
                  <SelectItem key={equipment} value={equipment}>
                    {formatEquipment(equipment)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Muscle Filter */}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={selectedMuscle === null ? "default" : "outline"}
              onClick={() => setSelectedMuscle(null)}
            >
              All
            </Button>
            {allMuscles.map((muscle) => (
              <Button
                key={muscle}
                size="sm"
                variant={selectedMuscle === muscle ? "default" : "outline"}
                onClick={() => setSelectedMuscle(muscle)}
              >
                {muscle}
              </Button>
            ))}
          </div>

          {/* Exercise List */}
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-2">
              {filteredExercises.map((exercise) => (
                <button
                  key={exercise.id}
                  onClick={() => handleSelect(exercise.id)}
                  className="w-full text-left p-3 rounded-lg border border-border bg-card hover:bg-accent transition-colors flex items-center gap-3"
                >
                  {exercise.thumbnailUrl ? (
                    <img
                      src={exercise.thumbnailUrl}
                      alt=""
                      loading="lazy"
                      className="h-12 w-12 rounded-md bg-white object-contain flex-shrink-0"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-md bg-muted flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <h4 className="font-medium mb-2">{exercise.name}</h4>
                    <div className="flex flex-wrap gap-1">
                      {exercise.muscle_weightings.map((mw, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {mw.muscle} {mw.weighting < 1 && `(${Math.round(mw.weighting * 100)}%)`}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </button>
              ))}
              {filteredExercises.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No exercises found</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}
