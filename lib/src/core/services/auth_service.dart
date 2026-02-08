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
    try {
      if (kIsWeb) {
        // On web, use Firebase Auth popup directly — no GIS script needed
        final provider = GoogleAuthProvider();
        return await _auth.signInWithPopup(provider);
      }

      // On native platforms, use google_sign_in package
      final GoogleSignInAccount? googleUser = await _gsi.signIn();

      if (googleUser == null) {
        throw Exception('Google Sign-In was cancelled by user');
      }

      final GoogleSignInAuthentication googleAuth =
          await googleUser.authentication;

      final credential = GoogleAuthProvider.credential(
        accessToken: googleAuth.accessToken,
        idToken: googleAuth.idToken,
      );

      return await _auth.signInWithCredential(credential);
    } on FirebaseAuthException catch (e) {
      throw Exception('Firebase Auth Error: ${e.message}');
    } catch (e) {
      throw Exception('Google Sign-In Error: $e');
    }
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
