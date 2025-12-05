import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL || 'http://localhost:8090')

// Disable auto cancellation to prevent request cancellation issues
pb.autoCancellation(false)

export default pb
