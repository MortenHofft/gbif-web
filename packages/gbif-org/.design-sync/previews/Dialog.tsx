import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from 'new-gbif-org-ts';

// Rendered `open` so the card shows the dialog itself rather than just a
// trigger button — the closed state has nothing to look at.
export const DownloadDialog = () => (
  <Dialog open modal={false}>
    <DialogContent className="g-max-w-lg">
      <DialogHeader>
        <DialogTitle>Create a download</DialogTitle>
        <DialogDescription>
          307,616,900 occurrence records match your current filters. Downloads are prepared in the
          background and you will get an email when the archive is ready.
        </DialogDescription>
      </DialogHeader>
      <div className="g-flex g-flex-col g-gap-2 g-py-2">
        <Label htmlFor="dl-format">Format</Label>
        <Input id="dl-format" defaultValue="Darwin Core Archive" />
      </div>
      <DialogFooter>
        <Button variant="outline">Cancel</Button>
        <Button>Request download</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export const ConfirmDestructive = () => (
  <Dialog open modal={false}>
    <DialogContent className="g-max-w-md">
      <DialogHeader>
        <DialogTitle>Delete this download?</DialogTitle>
        <DialogDescription>
          The archive and its DOI will stop resolving. Citations already published will break. This
          cannot be undone.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline">Keep download</Button>
        <Button variant="destructive">Delete</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
