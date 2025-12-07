<script setup lang="ts">
import { useFavoritesStore } from '../../stores/favorites'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const store = useFavoritesStore()
</script>
<template>
  <AlertDialog :open="store.alertDialog.visible">
    <AlertDialogContent>
      <AlertDialogTitle class="sr-only">{{ $t('app.alert') }}</AlertDialogTitle>
      <AlertDialogDescription class="text-center">
        {{ store.alertDialog.message }}
      </AlertDialogDescription>
      <AlertDialogFooter>
        <AlertDialogAction @click="store.closeAlert()">
          OK
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
