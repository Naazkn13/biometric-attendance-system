# V-Care Final Rollout Plan

Now that your production backend and database are successfully connected, you need to execute the final rollout. **Do NOT build and give the app to the doctor immediately.** If you give the doctor the app before the relay is running, the app will be completely empty and might look broken to them.

Follow these steps in exact order to ensure a smooth delivery:

## Phase 1: Establish the Data Pipeline (Hospital PC)

Before the mobile app is useful, it needs real data from the biometric device. 

1. **Set up the Relay**: Go to the hospital (or have someone there do it) and follow the steps we outlined earlier to install Python on the hospital's PC.
   - **CRITICAL NOTE FOR OLDER PCs**: If the hospital PC is running an older OS like Windows 7 or Windows 8, you MUST install **Python version 3.8** (e.g., Python 3.8.10). Newer versions of Python (3.9+) are not supported on older Windows operating systems. Ensure "Add python to PATH" is checked during installation.
2. **Run the Relay**: Start the `vcare_relay.py` script on the PC.
3. **Verify Data in Cloud**: 
   - Open your Supabase Dashboard (`kiwugfqlwjpperpbbfdx`).
   - Look at the `raw_punches` and `attendance_sessions` tables. 
   - Confirm that the punches have synced from the physical device up to the database.

## Phase 2: Local Mobile App Verification

Now that there is real data in the database, you need to verify the app reads it correctly.

1. **Run Locally**: In your terminal on your laptop, navigate to the `mobile/` directory and run:
   ```bash
   npx expo start
   ```
2. **Test on your Phone**: Scan the QR code using the Expo Go app on your own phone.
3. **Verify the UI**: 
   - Check the **Today** tab and the **Employee** tab.
   - Make sure you can see the real punches that just synced from the hospital device.
   - Log in using the Admin/Doctor credentials to make sure authentication works with the new backend.

## Phase 3: Build the Production App (APK)

Once you have verified that the app looks good on your phone using Expo Go, it's time to create the final standalone app.

1. **Trigger the Build**: Inside the `mobile/` directory, run your build command (e.g., using EAS):
   ```bash
   eas build -p android --profile production
   ```
   *(Or however you normally generate your `.apk` files for Android).*
2. **Download the APK**: Once the build finishes, download the `.apk` file to your computer.

## Phase 4: Delivery to the Doctor

1. **Transfer the APK**: Send the `.apk` file to the doctor via WhatsApp, Email, or direct USB transfer.
2. **Install**: Guide the doctor to install the app on their Android phone (they may need to allow "Install from unknown sources").
3. **First Login**: Provide the doctor with their Admin credentials and have them log in. They should immediately see the live attendance data of their hospital staff.

---

## User Review Required

Does this order of operations make sense to you? If you approve, your immediate next step is to head to the hospital and execute Phase 1! Let me know if you need any changes to this plan.
