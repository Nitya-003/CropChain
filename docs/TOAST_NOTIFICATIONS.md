# Toast Notifications - Developer Guide

## Quick Start

### Using Toast Notifications in Your Component

```typescript
import { useToast } from '../context/ToastContext';

const MyComponent: React.FC = () => {
  const toast = useToast();

  const handleAction = async () => {
    try {
      // Perform some action
      await performAction();
      
      // Show success toast
      toast.success('Action completed successfully!');
    } catch (error) {
      // Show error toast
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'An error occurred';
      toast.error(errorMessage);
    }
  };

  return (
    <button onClick={handleAction}>
      Perform Action
    </button>
  );
};

export default MyComponent;
```

## API Reference

### `useToast()` Hook

Returns an object with four methods:

#### `toast.success(message: string): void`
Displays a green success notification with a checkmark icon.

```typescript
toast.success('Batch created successfully!');
```

#### `toast.error(message: string): void`
Displays a red error notification with an alert icon.

```typescript
toast.error('Failed to save changes. Please try again.');
```

#### `toast.info(message: string): void`
Displays a blue informational notification with an info icon.

```typescript
toast.info('Processing your request...');
```

#### `toast.warning(message: string): void`
Displays an amber warning notification with a warning triangle icon.

```typescript
toast.warning('This action cannot be undone.');
```

## Toast Features

### Auto-dismiss
Toasts automatically disappear after 5 seconds.

### Manual Close
Users can click the X button to close a toast immediately.

### Dark Mode Support
Toasts automatically adapt to light/dark theme using Tailwind CSS `dark:` classes.

### Stacking
Multiple toasts stack vertically with proper spacing, not overlapping.

### Non-blocking
Toasts appear in a fixed position and don't interfere with page interactions.

## Best Practices

### 1. Always Handle Errors
```typescript
try {
  // operation
} catch (error) {
  const message = error instanceof Error 
    ? error.message 
    : 'Unknown error occurred';
  toast.error(message);
}
```

### 2. Provide Contextual Messages
❌ Bad:
```typescript
toast.success('Done');
```

✅ Good:
```typescript
toast.success('Batch #CROP-2024-001 created successfully!');
```

### 3. Use Appropriate Toast Types
- **Success**: For completed actions (batch created, data saved)
- **Error**: For failures (validation errors, server issues)
- **Info**: For status updates (searching, processing)
- **Warning**: For important alerts (data will be deleted)

### 4. Keep Messages Concise
Toast messages should be readable in 5 seconds. Aim for 1-2 sentences max.

❌ Too long:
```typescript
toast.success('Your batch has been created successfully and is now available in the system for tracking');
```

✅ Concise:
```typescript
toast.success('Batch created! ID: CROP-2024-001');
```

### 5. Include Relevant Context
```typescript
// When updating batch stage
toast.success(`Batch updated to ${updateData.stage} stage`);

// When verifying users
toast.success(`${userData.name} verified successfully!`);

// When copying data
toast.success('Batch ID copied to clipboard!');
```

## Examples from Implemented Flows

### AddBatch - Successful Creation
```typescript
const batch = await realCropBatchService.createBatch(formData);
toast.success(`Batch created successfully! ID: ${batch.batchId}`);
```

### UpdateBatch - Search Not Found
```typescript
catch (error) {
  const errorMessage = error instanceof Error ? error.message : 'Batch not found. Please check the ID and try again.';
  toast.error(errorMessage);
}
```

### TrackBatch - QR Code Scan
```typescript
toast.info(`QR code scanned! Searching for batch: ${result}`);
```

### VerificationDashboard - User Verified
```typescript
await verificationService.issueCredential(userId, walletAddress);
toast.success('User verified successfully!');
```

## Toast Styling Reference

### CSS Classes Used
- **Success**: Green-600, Green-900 (dark), bg-green-50
- **Error**: Red-600, Red-900 (dark), bg-red-50
- **Info**: Blue-600, Blue-900 (dark), bg-blue-50
- **Warning**: Amber-600, Amber-900 (dark), bg-amber-50

### Custom Styling
If you need to customize toasts, edit `src/components/Toast.tsx`:
- Change animation: Modify transform classes in `animationClasses`
- Change duration: Modify `AUTO_DISMISS_DURATION` in `ToastContext.tsx`
- Change position: Modify CSS classes in `ToastContainer.tsx`

## Troubleshooting

### Toast Not Appearing
1. Check that component is wrapped with `ToastProvider`
2. Verify you're using `useToast()` hook (not context directly)
3. Check browser console for errors

### Toast Disappearing Too Quickly
- Increase `AUTO_DISMISS_DURATION` in `src/context/ToastContext.tsx`
- Default is 5000ms (5 seconds)

### Dark Mode Not Working
- Ensure Tailwind's `darkMode` is enabled in `tailwind.config.js`
- Check that parent component has `dark:` class applied

### Multiple Toasts Overlapping
- This shouldn't happen. If it does, check CSS layout in `ToastContainer.tsx`
- Verify `z-index: 50` is high enough

## Component Files

- **Context**: `src/context/ToastContext.tsx`
- **Toast Component**: `src/components/Toast.tsx`
- **Container**: `src/components/ToastContainer.tsx`
- **Integration**: Check any page file (e.g., `src/pages/AddBatch.tsx`)

## Migration from Alert()

If migrating existing `alert()` calls to toasts:

### Before
```typescript
alert('Action successful!');
alert('Error: ' + error.message);
```

### After
```typescript
const toast = useToast();

// In success case
toast.success('Action successful!');

// In error case
const errorMessage = error instanceof Error ? error.message : 'Unknown error';
toast.error(errorMessage);
```

