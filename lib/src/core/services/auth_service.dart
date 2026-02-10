import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:google_sign_in/google_sign_in.dart';

class AuthService {
  final FirebaseAuth _auth = FirebaseAuth.instance;

  // Lazy-init to avoid crashing on web at startup
  GoogleSignIn? _googleSignIn;
  GoogleSignIn get _gsi => _googleSignIn ??= GoogleSignIn();

  User? get currentUser => _auth.currentUser;
  String? get uid => currentUser?.uid;

  Stream<User?> get authStateChanges => _auth.authStateChanges();

  Future<UserCredential> signInWithEmail(String email, String password) async {
    return _auth.signInWithEmailAndPassword(
      email: email,
      password: password,
    );
  }

  Future<UserCredential> signUpWithEmail(
    String email,
    String password,
  ) async {
    return _auth.createUserWithEmailAndPassword(
      email: email,
      password: password,
    );
  }

  Future<UserCredential> signInWithGoogle() async {
    if (kIsWeb) {
      return _signInWithGoogleWeb();
    }
    return _signInWithGoogleNative();
  }

  Future<UserCredential> _signInWithGoogleWeb() async {
    final provider = GoogleAuthProvider();
    try {
      return await _auth.signInWithPopup(provider);
    } on FirebaseAuthException catch (e) {
      if (e.code == 'popup-blocked' || e.code == 'popup-closed-by-user') {
        rethrow;
      }
      // Fall back to redirect flow for COOP and other popup failures
      return _signInWithGoogleRedirect(provider);
    }
  }

  Future<UserCredential> _signInWithGoogleRedirect(
    GoogleAuthProvider provider,
  ) async {
    await _auth.signInWithRedirect(provider);
    final result = await _auth.getRedirectResult();
    if (result.user == null) {
      throw FirebaseAuthException(
        code: 'redirect-failed',
        message: 'Google Sign-In redirect did not complete.',
      );
    }
    return result;
  }

  Future<UserCredential> _signInWithGoogleNative() async {
    final GoogleSignInAccount? googleUser = await _gsi.signIn();
    if (googleUser == null) {
      throw FirebaseAuthException(
        code: 'popup-closed-by-user',
        message: 'Google Sign-In was cancelled.',
      );
    }

    final GoogleSignInAuthentication googleAuth =
        await googleUser.authentication;

    final credential = GoogleAuthProvider.credential(
      accessToken: googleAuth.accessToken,
      idToken: googleAuth.idToken,
    );

    return await _auth.signInWithCredential(credential);
  }

  Future<void> signOut() async {
    if (!kIsWeb) {
      await _gsi.signOut();
    }
    await _auth.signOut();
  }

  Future<void> sendPasswordReset(String email) async {
    await _auth.sendPasswordResetEmail(email: email);
  }

  Future<void> updateDisplayName(String name) async {
    await currentUser?.updateDisplayName(name);
  }
}
