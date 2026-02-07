# CropChain Offline-First Architecture

## Overview

CropChain implements a robust offline-first architecture that allows farmers and supply chain actors to record data even without internet connectivity. All changes are automatically synced to the blockchain when connection is restored.

## Features

### ✅ Core Capabilities
- **Offline Batch Creation**: Create new crop batches without internet
- **Offline Updates**: Record supply chain updates while offline
- **Automatic Background Sync**: Changes sync automatically when online
- **Conflict Resolution**: Last-write-wins strategy for concurrent updates
- **Retry Logic**: Failed syncs automatically retry (up to 3 attempts)
- **Visual Indicators**: Clear UI feedback for sync status

### 🔧 Technical Implementation

#### 1. IndexedDB Storage
Uses `idb` library for robust local storage:
- **pendingBatches**: Stores batches created offline
- **pendingUpdates**: Stores supply chain updates made offline
- **syncQueue**: Manages sync priority and retry logic

#### 2. Sync Manager
Handles all synchronization logic:
- Monitors online/offline status
- Manages sync queue with priority
- Implements retry logic (max 3 attempts)
- Provides event listeners for UI updates

#### 3. Offline Service Layer
Enhanced batch service with offline support:
- Attempts online operations first
- Falls back to offline mode automatically
- Generates temporary IDs for offline batches
- Merges online and offline data seamlessly

## Usage

### For Developers

#### Initialize Offline Storage
```typescript
import { offlineStorage } from './services/offlineStorage';

// Initialize on app start
await offlineStorage.init();
```

#### Use Offline-Enabled Batch Service
```typescript
import { offlineCropBatchService } from './services/offlineCropBatchService';

// Create batch (works online or offline)
const batch = await offlineCropBatchService.createBatch({
  farmerName: 'John Doe',
  cropType: 'rice',
  quantity: 1000,
  // ... other fields
});

// Update batch (works online or offline)
const updated = await offlineCropBatchService.updateBatch(batchId, {
  stage: 'mandi',
  actor: 'Market Inspector',
  location: 'Punjab Mandi',
  notes: 'Quality checked'
});
```

#### Listen for Sync Events
```typescript
import { syncManager } from './services/syncManager';

// Listen for sync status changes
const unsubscribe = syncManager.onStatusChange((status) => {
  console.log('Sync status:', status); // 'idle' | 'syncing' | 'error'
});

// Listen for individual sync events
syncManager.onSync((event) => {
  console.log('Synced:', event.type, event.id, event.status);
});

// Manually trigger sync
await syncManager.triggerSync();
```

### For Users

#### Creating Batches Offline
1. Open the "Add Batch" page
2. Fill in all required information
3. Click "Submit Batch"
4. See "Pending Sync" badge on the batch
5. Changes automatically sync when online

#### Viewing Sync Status
- **Top-right indicator**: Shows online/offline status and pending count
- **Batch badges**: Each batch shows its sync status
- **Click indicator**: View detailed sync information

#### Handling Sync Errors
1. Check the sync status indicator
2. If errors occur, click "Retry Failed"
3. Ensure stable internet connection
4. Failed items automatically retry

## Architecture

### Data Flow

```
User Action (Create/Update)
         ↓
Is Online? → Yes → Try API Call
         ↓           ↓
        No      Success? → Yes → Return Result
         ↓           ↓
         ↓          No
         ↓           ↓
    Save to IndexedDB
         ↓
    Add to Sync Queue
         ↓
    Return Temp Result
         ↓
Connection Restored?
         ↓
    Sync Manager Triggered
         ↓
    Process Sync Queue
         ↓
    Update Status
```

### Sync Priority

1. **Priority 1**: New batches (critical data)
2. **Priority 2**: Supply chain updates
3. **Priority 3**: Other operations

### Conflict Resolution

**Strategy**: Last-Write-Wins (LWW)

- Each operation has a timestamp
- Server accepts the most recent update
- No manual conflict resolution needed
- Works well for supply chain (sequential updates)

**Future Enhancement**: Version-based conflict detection

## API Integration

### Backend Requirements

The backend must support:

1. **Idempotent Operations**: Same request can be sent multiple times
2. **Timestamp Validation**: Accept updates with valid timestamps
3. **Batch Status Tracking**: Track sync status in database
4. **Error Responses**: Clear error messages for failed syncs

### API Endpoints

```
POST /api/batches
- Creates new batch
- Returns: { success, batch, message }

PUT /api/batches/:batchId
- Updates existing batch
- Returns: { success, batch, message }

GET /api/batches/:batchId
- Retrieves batch details
- Returns: { success, batch }
```

## Testing Offline Mode

### Manual Testing

1. **Enable Offline Mode**:
   - Chrome DevTools → Network tab → Offline checkbox
   - Or: Airplane mode on mobile

2. **Create Test Batch**:
   - Fill form and submit
   - Verify "Pending Sync" badge appears
   - Check IndexedDB in DevTools

3. **Restore Connection**:
   - Disable offline mode
   - Watch sync indicator
   - Verify batch syncs successfully

4. **Test Sync Failure**:
   - Stop backend server
   - Create batch while online
   - Watch retry logic in action

### Automated Testing

```typescript
// Test offline batch creation
test('creates batch offline', async () => {
  // Mock navigator.onLine
  Object.defineProperty(navigator, 'onLine', {
    writable: true,
    value: false
  });

  const batch = await offlineCropBatchService.createBatch(testData);
  
  expect(batch.syncStatus).toBe('pending');
  expect(batch.batchId).toMatch(/^TEMP-/);
});

// Test sync on reconnection
test('syncs when connection restored', async () => {
  // Create offline batch
  const batch = await offlineCropBatchService.createBatch(testData);
  
  // Simulate reconnection
  Object.defineProperty(navigator, 'onLine', {
    value: true
  });
  
  await syncManager.triggerSync();
  
  const updated = await offlineStorage.getPendingBatch(batch.pendingId);
  expect(updated.status).toBe('synced');
});
```

## Performance Considerations

### Storage Limits
- IndexedDB: ~50MB per origin (varies by browser)
- Recommended: Clean up synced items periodically
- Monitor storage usage in production

### Sync Optimization
- Batch multiple operations when possible
- Use priority queue for critical data
- Implement exponential backoff for retries
- Limit concurrent sync operations

### Battery Impact
- Background sync uses Service Workers (minimal impact)
- Sync only when connection is stable
- Pause sync on low battery (future enhancement)

## Security

### Data Protection
- All data encrypted in transit (HTTPS)
- IndexedDB data stored locally (browser security)
- No sensitive data in temporary IDs
- Clear data on logout (future enhancement)

### Sync Validation
- Server validates all synced data
- Timestamps prevent replay attacks
- Rate limiting on sync endpoints
- Authentication required for all operations

## Troubleshooting

### Common Issues

**1. Batches Not Syncing**
- Check internet connection
- Verify backend is running
- Check browser console for errors
- Try manual sync from indicator

**2. Sync Status Stuck**
- Clear browser cache
- Check IndexedDB in DevTools
- Restart browser
- Contact support if persists

**3. Duplicate Batches**
- Check for multiple browser tabs
- Verify sync queue is processing
- Clear pending items if needed

### Debug Mode

Enable debug logging:
```typescript
// In browser console
localStorage.setItem('DEBUG_SYNC', 'true');

// Reload page to see detailed logs
```

## Future Enhancements

### Planned Features
- [ ] Service Worker background sync
- [ ] Conflict detection UI
- [ ] Batch sync operations
- [ ] Offline image caching
- [ ] Progressive Web App (PWA)
- [ ] Push notifications for sync status

### Advanced Conflict Resolution
- Version-based conflict detection
- Manual conflict resolution UI
- Merge strategies for concurrent updates
- Audit trail for all changes

---

**Built for farmers in remote areas with unreliable connectivity** 🌾