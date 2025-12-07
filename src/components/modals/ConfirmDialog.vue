<script setup lang="ts">
import { useFavoritesStore } from '../../stores/favorites'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const store = useFavoritesStore()
</script>
<template>
  <AlertDialog :open="store.confirmDialog.visible">
    <AlertDialogContent>
      <AlertDialogTitle class="sr-only">{{ $t('app.confirm') }}</AlertDialogTitle>
      <AlertDialogDescription class="text-center">
        {{ store.confirmDialog.message }}
      </AlertDialogDescription>
      <AlertDialogFooter>
        <AlertDialogCancel @click="store.respondConfirm(false)">
          Annuler
        </AlertDialogCancel>
        <AlertDialogAction variant="destructive" @click="store.respondConfirm(true)">
          Supprimer
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
