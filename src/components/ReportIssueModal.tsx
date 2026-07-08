import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MapPin, Send, Sparkles, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { addIncident, isUserSuspended, isUserInWarningZone, saveAgentDispatchResult, getUserProfile } from "@/lib/firebase-services";
import { analyzeIssue as runIssueAnalysis } from "@/lib/issue-analysis";
import { getSeverityBadgeClass, getSeverityLabel } from "@/lib/severity";
import { runAgenticAutoDispatch, shouldAutoEscalate } from "@/lib/agent-dispatch";
import { useAuth } from "@/contexts/AuthContext";

interface ReportIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedLocation?: {lat: number, lng: number} | null;
  onIncidentAdded?: (incidentId: string) => void; // Callback when incident is added
}

export const ReportIssueModal = ({ isOpen, onClose, selectedLocation, onIncidentAdded }: ReportIssueModalProps) => {
  const [description, setDescription] = useState("");
  const [aiSummary, setAiSummary] = useState("");
  const [severity, setSeverity] = useState<number | undefined>(undefined);
  const [category, setCategory] = useState<string>("");
  const [aiProvider, setAiProvider] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSuspended, setIsSuspended] = useState(false);
  const [isInWarningZone, setIsInWarningZone] = useState(false);
  
  // Debug: Track description changes
  useEffect(() => {
    console.log('ReportIssueModal: Description state changed to:', description);
    console.log('ReportIssueModal: Description type:', typeof description);
    console.log('ReportIssueModal: Description length:', description?.length);
  }, [description]);
  const { toast } = useToast();
  const { userData } = useAuth();

  // Debug: Check if user is authenticated
  useEffect(() => {
    console.log('ReportIssueModal mounted');
    console.log('Selected location:', selectedLocation);
    console.log('User data:', userData);
    console.log('User authenticated:', !!userData?.uid);
  }, [selectedLocation, userData]);

  // Check if user is suspended or in warning zone
  useEffect(() => {
    const checkUserStatus = async () => {
      if (userData?.uid) {
        const suspended = await isUserSuspended(userData.uid);
        const inWarningZone = await isUserInWarningZone(userData.uid);
        
        setIsSuspended(suspended);
        setIsInWarningZone(inWarningZone);
        
        console.log('User suspension status:', suspended);
        console.log('User warning zone status:', inWarningZone);
      }
    };
    
    checkUserStatus();
  }, [userData?.uid]);

  const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
  const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
  const GEMINI_MODEL = import.meta.env.VITE_GEMINI_MODEL;

  const analyzeIssue = async () => {
    if (!description?.trim()) {
      toast({
        title: "Description Required",
        description: "Please describe the issue before analyzing.",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);

    try {
      const result = await runIssueAnalysis(description.trim(), {
        groqApiKey: GROQ_API_KEY,
        geminiApiKey: GEMINI_API_KEY,
        geminiModel: GEMINI_MODEL,
        allowLocalFallback: false,
      });

      setAiSummary(result.summary);
      setSeverity(result.severity);
      setCategory(result.category);
      localStorage.setItem("current_ai_category", result.category);

      const provider = result.source === "groq" ? "Groq AI" : result.source === "gemini" ? "Gemini AI" : "Local AI";
      setAiProvider(provider);
      toast({
        title: "Analysis Complete",
        description: `AI: ${result.category} — Severity ${result.severity}`,
      });
    } catch (error) {
      console.error("Error analyzing issue:", error);
      toast({
        title: "AI Analysis Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = async () => {
    // Check if user is suspended based on score
    if (isSuspended) {
      toast({
        title: "Account Suspended",
        description: "Your account has been suspended due to low score (below -80). You cannot submit reports until your score improves.",
        variant: "destructive"
      });
      return;
    }

    if (!description.trim()) {
      toast({
        title: "Description Required",
        description: "Please provide a description of the issue.",
        variant: "destructive"
      });
      return;
    }

    if (!selectedLocation) {
      toast({
        title: "Location Required",
        description: "Please select a location on the map first.",
        variant: "destructive"
      });
      return;
    }

      if (!aiSummary || !category || !severity || severity < 1 || severity > 5) {
        console.log('ReportIssueModal: Missing or invalid AI analysis data:', { aiSummary, category, severity });
        toast({
          title: "AI Analysis Required",
          description: "Please analyze the issue with AI before submitting. The AI must determine a valid severity level (1-5).",
          variant: "destructive"
        });
        return;
      }

    try {
      if (!userData?.uid) {
        throw new Error('User not authenticated. Please login again.');
      }
      
      // First, add the incident to Firebase
      const incidentData = {
        description: description,
        location: {
          lat: selectedLocation.lat,
          lng: selectedLocation.lng
        }
      };

      let incidentId: string;
      try {
        // Create incident with AI analysis - no fallbacks to override AI determination
        const aiAnalysis = {
          summary: aiSummary || 'Manual review required',
          category: category || 'Other',
          severity: severity // Use AI-determined severity without fallback
        };
        
        console.log('ReportIssueModal: ===== SUBMITTING INCIDENT =====');
        console.log('ReportIssueModal: AI Analysis object being passed:', aiAnalysis);
        console.log('ReportIssueModal: AI Analysis severity:', aiAnalysis.severity);
        console.log('ReportIssueModal: AI Analysis severity type:', typeof aiAnalysis.severity);
        console.log('ReportIssueModal: Current state - aiSummary:', aiSummary, 'category:', category, 'severity:', severity);
        console.log('ReportIssueModal: ===============================');
        
        // Test: Check if the data is correct before sending
        if (aiAnalysis.severity !== severity) {
          console.error('ReportIssueModal: SEVERITY MISMATCH!');
          console.error('ReportIssueModal: aiAnalysis.severity:', aiAnalysis.severity);
          console.error('ReportIssueModal: state severity:', severity);
        }
        
        incidentId = await addIncident(incidentData, aiAnalysis, userData);
        console.log('Incident created with ID:', incidentId);
      } catch (addError) {
        console.error('Error in addIncident:', addError);
        throw new Error(`Failed to add incident: ${addError.message}`);
      }

      // Use latest Firestore score (auth session may be stale / missing score)
      let reporterScore = Number((userData as { score?: number }).score || 0);
      try {
        const profile = await getUserProfile(userData.uid);
        if (profile) {
          reporterScore = Number(profile.score || 0);
        }
      } catch (profileError) {
        console.warn('Could not refresh score for auto-dispatch:', profileError);
      }

      const shouldEscalate = shouldAutoEscalate(reporterScore, severity);
      const submitDescription = description;
      const submitCategory = category || "Other";
      const submitSeverity = severity;
      const submitLocation = {
        lat: selectedLocation.lat,
        lng: selectedLocation.lng,
      };

      // Reset + close immediately so the user never has to dismiss the modal manually.
      setDescription("");
      setAiSummary("");
      setSeverity(undefined);
      setCategory("");
      setAiProvider("");
      onClose();

      toast({
        title: shouldEscalate
          ? "Emergency Auto-Dispatched!"
          : "Report Submitted Successfully!",
        description: shouldEscalate
          ? "Trusted citizen severity-5 report was sent to nearest authorities automatically."
          : "Your issue has been reported and submitted for review.",
      });

      if (onIncidentAdded) {
        onIncidentAdded(incidentId);
      }

      // Run agent dispatch after close so mailto/tel can't keep the dialog open.
      if (shouldEscalate) {
        void (async () => {
          try {
            const dispatch = await runAgenticAutoDispatch({
              incidentId,
              userScore: reporterScore,
              userName: userData.displayName || userData.email || "Citizen",
              userEmail: userData.email || "unknown@email.com",
              description: submitDescription,
              category: submitCategory,
              severity: submitSeverity,
              location: submitLocation,
            });

            await saveAgentDispatchResult(incidentId, {
              triggered: dispatch.triggered,
              reason: dispatch.reason,
              ...(dispatch.authority?.name ? { authorityName: dispatch.authority.name } : {}),
              ...(dispatch.authority?.phone ? { authorityPhone: dispatch.authority.phone } : {}),
              ...(dispatch.authority?.email ? { authorityEmail: dispatch.authority.email } : {}),
              ...(typeof dispatch.authority?.distanceKm === "number"
                ? { distanceKm: dispatch.authority.distanceKm }
                : {}),
              emailOpened: dispatch.actions.emailOpened,
              emailSubmitted: dispatch.actions.emailSubmitted,
              callOpened: dispatch.actions.callOpened,
              ...(dispatch.actions.callNumber ? { callNumber: dispatch.actions.callNumber } : {}),
              ...(dispatch.messagePreview ? { messagePreview: dispatch.messagePreview } : {}),
              createdAt: dispatch.createdAt,
            });

            toast({
              title: "Agent Auto-Dispatched Authorities",
              description: dispatch.authority
                ? `Nearest authority contacted: ${dispatch.authority.name}${dispatch.actions.callNumber ? ` (${dispatch.actions.callNumber})` : ""}`
                : "Emergency auto-dispatch triggered.",
            });
          } catch (dispatchError) {
            console.error("Agent auto-dispatch failed:", dispatchError);
            toast({
              title: "Auto-dispatch failed",
              description: "Report was saved, but automatic authority contact could not complete.",
              variant: "destructive",
            });
          }
        })();
      }
    } catch (error) {
      console.error('Error saving incident:', error);
      toast({
        title: "Submission Failed",
        description: `Failed to save the incident to database: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="card-city max-w-md animate-slide-up z-[9999]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-primary" />
            <span>Report City Issue</span>
          </DialogTitle>
          <DialogDescription>
            Describe the issue you've encountered and our AI will analyze its severity.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={(e) => {
          e.preventDefault();
          console.log('ReportIssueModal: Form submitted via form element');
          handleSubmit();
        }} className="space-y-4 relative z-30">
          {/* Location Display */}
          {selectedLocation && (
            <div className="flex items-center space-x-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
              <MapPin className="h-4 w-4" />
              <span>Location: {selectedLocation.lat.toFixed(4)}, {selectedLocation.lng.toFixed(4)}</span>
            </div>
          )}

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Issue Description</Label>
            <Textarea
              id="description"
              placeholder="Describe the issue you've encountered (e.g., pothole, broken streetlight, garbage overflow...)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onFocus={(e) => console.log('Description textarea focused')}
              onClick={(e) => console.log('Description textarea clicked')}
              className="bg-muted/50 border-border/50 min-h-[100px] relative z-20 cursor-text"
              rows={4}
            />
          </div>

          {/* AI Analysis Button */}
          <Button 
            type="button"
            onClick={(e) => {
              console.log('Analyze button clicked');
              analyzeIssue();
            }}
            disabled={!description.trim() || isAnalyzing}
            className="w-full bg-gradient-to-r from-primary to-secondary text-white hover:opacity-90 relative z-30"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {isAnalyzing ? "Analyzing..." : "Analyze with AI"}
          </Button>
          


          {/* AI Summary */}
          {aiSummary && (
            <div className="space-y-3 p-4 bg-muted/30 rounded-lg border border-border/50">
              <div className="flex items-center space-x-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">AI Analysis</span>
              </div>
              
              <div className="space-y-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Summary</Label>
                  <p className="text-sm">{aiSummary}</p>
                </div>
                
                <div>
                  <Label className="text-xs text-muted-foreground">Category</Label>
                  <Badge variant="outline" className="text-xs mt-1">
                    {category}
                  </Badge>
                </div>
                
                <div>
                  <Label className="text-xs text-muted-foreground">Severity Level</Label>
                  <div className="flex items-center space-x-2 mt-1">
                    <Badge className={`${getSeverityBadgeClass(severity)} text-white`}>
                      Level {severity}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {getSeverityLabel(severity)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Warning Zone Alert */}
          {isInWarningZone && !isSuspended && (
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <div className="flex items-center space-x-2 text-yellow-600">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">Warning Zone</span>
              </div>
              <p className="text-xs text-yellow-500 mt-1">
                Your score is negative. Improve your score to avoid suspension. Score below -80 will result in account suspension.
              </p>
            </div>
          )}

          {/* Suspension Warning */}
          {isSuspended && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
              <div className="flex items-center space-x-2 text-red-600">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">Account Suspended</span>
              </div>
              <p className="text-xs text-red-500 mt-1">
                Your account has been suspended due to low score (below -80). You cannot submit reports until your score improves.
              </p>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex space-x-2 pt-2">
            <Button 
              type="button"
              variant="outline" 
              onClick={(e) => {
                console.log('Cancel button clicked');
                onClose();
              }} 
              className="flex-1 bg-muted/50 border-border/50 relative z-30"
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              className="flex-1 btn-city btn-glow relative z-30"
              disabled={!description.trim() || !aiSummary || !category || !severity || isSuspended}
            >
              <Send className="h-4 w-4 mr-2" />
              {isSuspended ? 'Account Suspended' : 'Submit Report'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};