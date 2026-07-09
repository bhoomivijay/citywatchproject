import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { AuthService } from "@/lib/auth-service";
import { useAuth } from "@/contexts/AuthContext";
import { MapPin, User, Mail, Lock, Eye, EyeOff, Shield } from "lucide-react";

const SignUp = () => {
  const [formData, setFormData] = useState({
    displayName: "",
    email: "",
    password: "",
    confirmPassword: ""
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isAdminSignup, setIsAdminSignup] = useState(false);
  
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentUser, userData, isAdmin } = useAuth();
  
  // Check if current user is admin and can create admin accounts
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const isAdminRequest = urlParams.get('admin') === 'true';
    
    if (isAdminRequest && currentUser && isAdmin) {
      // Only allow admin creation if current user is admin and admin parameter is set
      setIsAdminSignup(true);
    } else if (isAdminRequest && (!currentUser || !isAdmin)) {
      // Redirect if trying to create admin without being admin
      navigate('/login');
      return;
    } else {
      // Regular users cannot create admin accounts
      setIsAdminSignup(false);
    }
  }, [currentUser, isAdmin, navigate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError(""); // Clear error when user types
  };

  const validateForm = (): boolean => {
    if (!formData.displayName.trim()) {
      setError("Display name is required");
      return false;
    }
    
    if (!formData.email.trim()) {
      setError("Email is required");
      return false;
    }
    
    if (!formData.password) {
      setError("Password is required");
      return false;
    }
    
    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters long");
      return false;
    }
    
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsLoading(true);
    setError("");
    
    try {
      // Show immediate feedback
      toast({
        title: "Creating Account...",
        description: "Please wait while we set up your account.",
      });
      
      await AuthService.signUp(
        formData.email,
        formData.password,
        formData.displayName,
        isAdminSignup
      );
      
      toast({
        title: "Account Created Successfully!",
        description: "Welcome to CityWatch! You can now sign in.",
      });
      
      navigate("/login");
    } catch (error: any) {
      console.error('Signup error:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        stack: error.stack
      });
      setError(`Signup failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setIsLoading(true);
    setError("");

    try {
      await AuthService.signInWithGooglePopup();
      navigate("/dashboard");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Google sign-up failed';
      setError(message);
      setIsLoading(false);
    }
  };

  // Redirect non-admin users away from admin signup
  if (isAdminSignup && (!currentUser || !isAdmin)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="card-city max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-xl text-destructive">Access Denied</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <Shield className="h-16 w-16 text-destructive mx-auto" />
            <p className="text-muted-foreground">
              Only existing administrators can create new admin accounts.
            </p>
            <Button onClick={() => navigate('/login')} className="w-full">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
      <div className="w-full max-w-md relative z-40">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-lg flex items-center justify-center mx-auto mb-4">
            <MapPin className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-gradient mb-2">CityWatch</h1>
          <p className="text-muted-foreground">Create your account to get started</p>
        </div>

        {/* Sign Up Form */}
        <Card className="card-city relative z-20">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl">
              {isAdminSignup ? "Create Admin Account" : "Create Account"}
            </CardTitle>
            {isAdminSignup && (
              <p className="text-sm text-primary font-medium">
                Creating Administrator Account
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-4 relative z-30">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Display Name */}
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="displayName"
                    name="displayName"
                    type="text"
                    placeholder="Enter your full name"
                    value={formData.displayName}
                    onChange={handleInputChange}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="Enter your email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="pl-10 pr-10"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm your password"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    className="pl-10 pr-10"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              


              {/* Error Display */}
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full btn-city"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Creating Account...
                  </>
                ) : (
                  isAdminSignup ? "Create Admin Account" : "Create Account"
                )}
              </Button>
            </form>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>

            {/* Google Sign Up */}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogleSignUp}
              disabled={isLoading}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></div>
                  Signing up...
                </>
              ) : (
                "Sign up with Google"
              )}
            </Button>

            {/* Sign In Link */}
            <div className="text-center text-sm relative z-30">
              <span className="text-muted-foreground">Already have an account? </span>
              <Link
                to="/login"
                className="text-primary hover:underline font-medium cursor-pointer relative z-30"
              >
                Sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SignUp;
