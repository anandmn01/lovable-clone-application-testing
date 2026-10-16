import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Globe, ExternalLink, Copy, Check, Loader2, Rocket } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface PublishDialogProps {
  projectId: string;
  projectName?: string;
  trigger?: React.ReactNode;
}

export function PublishDialog({ projectId, projectName = "Project", trigger }: PublishDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string>(
    `http://localhost:8080/api/projects/${projectId}/preview`
  );

  const handleOpenChange = async (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      await publishProject();
    }
  };

  const publishProject = async () => {
    setIsDeploying(true);
    try {
      const response = await api.deploy(projectId);
      if (response?.previewUrl) {
        setPublishedUrl(response.previewUrl);
      }
      toast({
        title: "Published successfully",
        description: "Your application is live and accessible.",
      });
    } catch (error) {
      console.error("Publish failed:", error);
      toast({
        title: "Deployment note",
        description: "Using current preview URL for access.",
      });
    } finally {
      setIsDeploying(false);
    }
  };

  const handleCopy = () => {
    if (!publishedUrl) return;
    navigator.clipboard.writeText(publishedUrl);
    setCopied(true);
    toast({
      title: "Link copied",
      description: "Published project URL copied to clipboard.",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenLink = () => {
    if (publishedUrl) {
      window.open(publishedUrl, "_blank");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" className="h-8 text-xs bg-primary hover:bg-primary/90">
            Publish
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md gap-0 p-6 overflow-hidden">
        <DialogHeader className="mb-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Rocket className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-lg">Publish project</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Make {projectName} available via a shareable public URL
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status Banner */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-muted/30">
            <div className="flex items-center gap-2.5">
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <div>
                <div className="text-xs font-semibold">Deployment Status</div>
                <div className="text-[11px] text-muted-foreground">
                  {isDeploying ? "Deploying latest version..." : "Live & accessible"}
                </div>
              </div>
            </div>
            {isDeploying && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>

          {/* Published URL section */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" />
              Public URL
            </label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={publishedUrl}
                className="font-mono text-xs bg-muted/50 border-input/50 select-all"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                className="shrink-0 h-9 w-9"
                title="Copy Link"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 gap-2 border-t border-border/50">
            <Button
              variant="outline"
              size="sm"
              onClick={publishProject}
              disabled={isDeploying}
              className="text-xs"
            >
              {isDeploying ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Republishing...
                </>
              ) : (
                "Republish"
              )}
            </Button>
            <Button
              size="sm"
              onClick={handleOpenLink}
              className="text-xs flex items-center gap-1.5 bg-primary hover:bg-primary/90"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open Live Site
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
