"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useAuth } from "@/lib/auth-context"
import { getRoutinesFromFirebase, getPrioritiesFromFirebase } from "@/lib/firebase-storage"
import { useToast } from "@/hooks/use-toast"
import type { Routine, PriorityTier } from "@/lib/types"
import { Calendar, Dumbbell, Loader2 } from "lucide-react"

interface SavedRoutinesModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onLoadRoutine: (routine: Routine) => void
  onLoadPriorities: (priorities: Partial<Record<PriorityTier, string[]>>) => void
}

export function SavedRoutinesModal({ open, onOpenChange, onLoadRoutine, onLoadPriorities }: SavedRoutinesModalProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [routines, setRoutines] = useState<Routine[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open && user) {
      loadRoutines()
    }
  }, [open, user])

  const loadRoutines = async () => {
    if (!user) return

    setLoading(true)
    try {
      const fetchedRoutines = await getRoutinesFromFirebase(user.uid)
      setRoutines(fetchedRoutines)
    } catch (error) {
      toast({
        title: "Failed to load routines",
        description: error instanceof Error ? error.message : "Could not fetch your saved routines",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleLoadRoutine = async (routine: Routine) => {
    if (!user) return

    try {
      const priorities = await getPrioritiesFromFirebase(user.uid)
      onLoadRoutine(routine)
      onLoadPriorities(priorities)
      onOpenChange(false)
      toast({
        title: "Routine loaded",
        description: `"${routine.name}" has been loaded successfully`,
      })
    } catch (error) {
      toast({
        title: "Failed to load routine",
        description: error instanceof Error ? error.message : "Could not load the routine",
        variant: "destructive",
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>My Saved Routines</DialogTitle>
          <DialogDescription>Load a previously saved routine from your account</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : routines.length === 0 ? (
          <div className="text-center py-12">
            <Dumbbell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">No saved routines</h3>
            <p className="text-sm text-muted-foreground">Create a routine and save it to your account to see it here</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {routines.map((routine) => (
                <Card key={routine.id} className="p-4 hover:bg-accent/50 transition-colors cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold mb-1">{routine.name}</h4>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {routine.days.length} days
                        </span>
                        <span className="flex items-center gap-1">
                          <Dumbbell className="h-3 w-3" />
                          {routine.days.reduce((sum, day) => sum + day.exercises.length, 0)} exercises
                        </span>
                      </div>
                    </div>
                    <Button onClick={() => handleLoadRoutine(routine)}>Load</Button>
                  </div>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  )
}
