# 🚨 SECURITY ACTION REQUIRED 🚨

A critical security vulnerability has been identified: the Firebase API key (`google-services.json`) was inadvertently committed to the public repository.

**You must take the following manual actions immediately:**

1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Select your project.
3. Navigate to **Project Settings** > **Service accounts**.
4. Generate a new private key and download the new `google-services.json` file.
5. In the Google Cloud Console (IAM & Admin -> Service Accounts), delete the compromised key.
6. Replace your local `google-services.json` with the newly downloaded file.

This file has now been added to `.gitignore` and an example file has been provided to prevent this from happening in the future.
