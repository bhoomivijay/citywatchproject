import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, Shield, Building, User, Crown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AuthService } from "@/lib/auth-service";
import { useAuth } from "@/contexts/AuthContext";
import citySkyline from "@/assets/city-skyline.jpg";


const Login = () => {
  const [loginType, setLoginType] = useState<"user" | "admin">("user");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentUser, userData, isAdmin, isAdminResolved, isLoading: authLoading } = useAuth();

  // Only redirect after an explicit Google sign-in redirect — not for saved sessions.
  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!currentUser) {
      AuthService.clearPendingAuthRedirect();
      return;
    }

    if (!userData || !AuthService.hasPendingAuthRedirect() || !isAdminResolved) {
      return;
    }

    const intent = AuthService.getLoginIntent() ?? "user";
    AuthService.clearPendingAuthRedirect();
    AuthService.clearLoginIntent();

    if (intent === "admin") {
      if (isAdmin) {
        navigate("/admin", { replace: true });
      } else {
        void AuthService.signOut();
        setError("This account is not authorized for admin access.");
      }
      return;
    }

    // intent === "user"
    if (!isAdmin) {
      navigate("/dashboard", { replace: true });
    } else {
      void AuthService.signOut();
      setError("This account is not authorized for citizen access.");
    }
  }, [authLoading, currentUser, userData, isAdmin, isAdminResolved, navigate]);



  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }

    setIsLoading(true);
    setError("");
    
    try {
      // Show immediate feedback
      toast({
        title: "Authenticating...",
        description: "Please wait while we verify your credentials.",
      });
      
      console.log('Attempting email/password login...');
      const user = await AuthService.signIn(email, password);
      console.log('Email/password login successful:', user);
      
      // Check if user is admin
      console.log('Checking if user is admin...');
      const adminStatus = await AuthService.isAdmin(user.uid);
      console.log('Is admin:', isAdmin);

      // Strict routing: Admin tab only for admins; Citizen tab only for non-admins
      if (loginType === "admin") {
        if (!adminStatus) {
          await AuthService.signOut();
          setError("This account is not authorized for admin access.");
          return;
        }
        toast({
          title: "Admin Login Successful",
          description: `Welcome Admin ${user.displayName}!`,
        });
        navigate("/admin");
      } else {
        if (adminStatus) {
          await AuthService.signOut();
          setError("This account is not authorized for citizen access.");
          return;
        }
        toast({
          title: "Login Successful",
          description: `Welcome ${user.displayName}!`,
        });
        navigate("/dashboard");
      }
    } catch (error: any) {
      console.error('Email/password login error:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        stack: error.stack
      });
      setError(`Login failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError("");

    try {
      // Prefer popup (redirect can fail when storage is partitioned/cleared)
      const user = await AuthService.signInWithGooglePopup();
      const adminStatus = await AuthService.isAdmin(user.uid);

      if (loginType === "admin") {
        if (!adminStatus) {
          await AuthService.signOut();
          setError("This account is not authorized for admin access.");
          return;
        }
        toast({
          title: "Admin Login Successful",
          description: `Welcome Admin ${user.displayName}!`,
        });
        navigate("/admin");
      } else {
        if (adminStatus) {
          await AuthService.signOut();
          setError("This account is not authorized for citizen access.");
          return;
        }
        toast({
          title: "Login Successful",
          description: `Welcome ${user.displayName}!`,
        });
        navigate("/dashboard");
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Google login failed';
      console.error('Google login error:', error);
      setError(`Google login failed: ${message}`);
      setIsLoading(false);
    }
  };



  const handleLogout = async () => {
    try {
      await AuthService.signOut();
      toast({
        title: "Logged Out",
        description: "You have been logged out successfully.",
      });
      // Force page reload to clear any cached state
      window.location.reload();
    } catch (error) {
      console.error('Logout error:', error);
      setError("Failed to logout. Please try again.");
    }
  };





  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Background with city skyline */}
      <div 
        className="full-viewport-bg pointer-events-none"
        style={{ 
          backgroundImage: `url(${citySkyline})`
        }}
      >
        <div className="absolute inset-0 bg-gradient-skyline" />
      </div>

      {/* Floating geometric shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-20 h-20 bg-primary/10 rounded-full animate-float" />
        <div className="absolute top-40 right-32 w-16 h-16 bg-accent/10 rotate-45 animate-float" style={{ animationDelay: "1s" }} />
        <div className="absolute bottom-32 left-1/4 w-12 h-12 bg-secondary/10 rounded-full animate-float" style={{ animationDelay: "2s" }} />
      </div>

      {/* Login Card */}
      <Card className="card-city w-full max-w-md mx-4 animate-slide-up relative z-10">
        <CardHeader className="text-center space-y-4">
          <div className="flex items-center justify-center space-x-2">
            <Building className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold text-gradient">CityWatch</h1>
          </div>
          <CardTitle className="text-xl text-foreground">
            Smart City Management
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Report and manage city issues efficiently
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 relative z-30">
          {/* User/Admin Toggle */}
          <Tabs value={loginType} onValueChange={(value) => setLoginType(value as "user" | "admin")} className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-muted/50">
              <TabsTrigger value="user" className="flex items-center space-x-2">
                <User className="h-4 w-4" />
                <span>Citizen</span>
              </TabsTrigger>
              <TabsTrigger value="admin" className="flex items-center space-x-2">
                <Shield className="h-4 w-4" />
                <span>Admin</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="user" className="space-y-4 mt-6">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="citizen@city.gov"
                    className="bg-muted/50 border-border/50 relative z-20 cursor-text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input 
                    id="password" 
                    type="password"
                    className="bg-muted/50 border-border/50 relative z-20 cursor-text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required 
                  />
                </div>
                <Button 
                  type="submit" 
                  className="btn-city btn-glow w-full"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Authenticating...
                    </>
                  ) : (
                    <>
                      <MapPin className="h-4 w-4 mr-2" />
                      Login as Citizen
                    </>
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="admin" className="space-y-4 mt-6">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="admin-email">Admin Email</Label>
                  <Input 
                    id="admin-email" 
                    type="email" 
                    placeholder="admin@city.gov"
                    className="bg-muted/50 border-border/50"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-password">Password</Label>
                  <Input 
                    id="admin-password" 
                    type="password"
                    className="bg-muted/50 border-border/50"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required 
                  />
                </div>
                <Button 
                  type="submit" 
                  className="btn-city btn-glow w-full"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Authenticating...
                    </>
                  ) : (
                    <>
                      <Shield className="h-4 w-4 mr-2" />
                      Login as Admin
                    </>
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          {/* Error Display */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}



          {/* Social Login */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border/50" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>

          <Button 
            variant="outline" 
            className="w-full bg-muted/50 border-border/50 hover:bg-muted/70"
            onClick={handleGoogleLogin}
            type="button"
            disabled={isLoading}
          >
            <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></div>
                Signing in...
              </>
            ) : (
              "Continue with Google"
            )}
          </Button>



          {/* Sign Up Link */}
          <div className="text-center text-sm pt-4">
            <span className="text-muted-foreground">Don't have an account? </span>
            <Link
              to="/signup"
              className="text-primary hover:underline font-medium cursor-pointer"
              onClick={() => console.log('Sign up link clicked')}
            >
              Sign up
            </Link>
          </div>


        </CardContent>
      </Card>
    </div>
  );
};

export default Login;