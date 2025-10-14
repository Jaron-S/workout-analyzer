"use client"

import { useState, useMemo } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search } from "lucide-react"
import exercises from "@/data/exercises.json"

interface ExerciseLibraryModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectExercise: (exerciseId: string) => void
}

export function ExerciseLibraryModal({ open, onOpenChange, onSelectExercise }: ExerciseLibraryModalProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null)

  const allMuscles = useMemo(() => {
    const muscles = new Set<string>()
    exercises.forEach((ex) => {
      ex.muscle_weightings.forEach((mw) => muscles.add(mw.muscle))
    })
    return Array.from(muscles).sort()
  }, [])

  const filteredExercises = useMemo(() => {
    return exercises.filter((ex) => {
      const matchesSearch = ex.name.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesMuscle = !selectedMuscle || ex.muscle_weightings.some((mw) => mw.muscle === selectedMuscle)
      return matchesSearch && matchesMuscle
    })
  }, [searchQuery, selectedMuscle])

  const handleSelect = (exerciseId: string) => {
    onSelectExercise(exerciseId)
    onOpenChange(false)
    setSearchQuery("")
    setSelectedMuscle(null)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Exercise Library</DialogTitle>
          <DialogDescription>Search and filter exercises to add to your routine</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search exercises..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
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
                  className="w-full text-left p-3 rounded-lg border border-border bg-card hover:bg-accent transition-colors"
                >
                  <h4 className="font-medium mb-2">{exercise.name}</h4>
                  <div className="flex flex-wrap gap-1">
                    {exercise.muscle_weightings.map((mw, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {mw.muscle} {mw.weighting < 1 && `(${Math.round(mw.weighting * 100)}%)`}
                      </Badge>
                    ))}
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
