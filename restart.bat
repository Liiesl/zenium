@echo off
SETLOCAL ENABLEDELAYEDEXPANSION

REM ---
REM This script finds the latest Git tag using semantic versioning,
REM then deletes and recreates it locally and on the remote 'origin'
REM using a specific sequence of commands.
REM ---

REM Find the latest tag by sorting all tags by version number (descending).
FOR /F "tokens=*" %%g IN ('git tag --sort=-v:refname') DO (
    SET LATEST_TAG=%%g
    GOTO :FoundTag
)

:FoundTag
IF NOT DEFINED LATEST_TAG (
    ECHO No tags were found in the repository.
    EXIT /B 1
)

ECHO The latest tag found is: %LATEST_TAG%

:Confirm
ECHO.
SET /P AREYOUSURE=Are you sure you want to replace the tag '%LATEST_TAG%'? (Y/[N]): 
IF /I "%AREYOUSURE%" NEQ "Y" (
    ECHO Operation cancelled by user.
    EXIT /B 2
)

ECHO Proceeding with the operation...

REM --- Step 1: Delete the local tag ---
ECHO.
ECHO Running: git tag -d %LATEST_TAG%
git tag -d %LATEST_TAG%
IF !ERRORLEVEL! NEQ 0 (
    ECHO FAILED: Could not delete the local tag.
    EXIT /B 1
)

REM --- Step 2: Delete the remote tag ---
ECHO.
ECHO Running: git push origin --delete %LATEST_TAG%
git push origin --delete %LATEST_TAG%
IF !ERRORLEVEL! NEQ 0 (
    ECHO WARNING: Failed to delete remote tag. It might not exist on the remote. Continuing...
)

REM --- Step 3: Recreate the tag locally (as a lightweight tag) ---
ECHO.
ECHO Running: git tag %LATEST_TAG%
git tag %LATEST_TAG%
IF !ERRORLEVEL! NEQ 0 (
    ECHO FAILED: Could not recreate the local tag.
    EXIT /B 1
)

REM --- Step 4: Push tags to the remote ---
ECHO.
ECHO Running: git push --tags
git push --tags
IF !ERRORLEVEL! NEQ 0 (
    ECHO FAILED: Could not push tags to the remote.
    EXIT /B 1
)

ECHO.
ECHO Successfully replaced tag '%LATEST_TAG%'.
ENDLOCAL