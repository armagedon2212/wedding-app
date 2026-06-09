async function main() {
  console.log("Fetching Service Account token from metadata server...");
  const tokenResponse = await fetch(
    "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
    { headers: { "Metadata-Flavor": "Google" } }
  );
  if (!tokenResponse.ok) {
    throw new Error(`Failed to get access token: ${tokenResponse.status}`);
  }
  const { access_token } = await tokenResponse.json();
  console.log("Token obtained successfully.");

  const projectId = "wedding-app-c66bc";
  const databaseId = "ai-studio-1ddfbf03-c3d5-47f5-ade4-844d9d8bd64c";
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents`;

  const headers = {
    Authorization: `Bearer ${access_token}`,
    "Content-Type": "application/json"
  };

  // 1. Fetching & Deleting photos (including those that are marked deleted)
  console.log("Listing photo documents via REST API (unfiltered)...");
  const photosUrl = `${baseUrl}/photos?pageSize=500`;
  const photosRes = await fetch(photosUrl, { headers });
  if (photosRes.ok) {
    const photosData = await photosRes.json();
    const documents = photosData.documents || [];
    console.log(`Found ${documents.length} photos in DB to permanently delete.`);
    for (const doc of documents) {
      const docName = doc.name; // Full path e.g. projects/.../documents/photos/...
      console.log(`Deleting photo document: ${docName}`);
      const deleteRes = await fetch(`https://firestore.googleapis.com/v1/${docName}`, {
        method: "DELETE",
        headers
      });
      if (deleteRes.ok) {
        console.log(`Successfully deleted ${docName.split("/").pop()}`);
      } else {
        console.error(`Failed to delete ${docName}:`, deleteRes.status);
      }
    }
  } else {
    console.error("Failed to list photos:", photosRes.status, await photosRes.text());
  }

  // 2. Fetching & Deleting songs (including those already flagged as deleted)
  console.log("Listing song documents via REST API (unfiltered)...");
  const songsUrl = `${baseUrl}/songs?pageSize=500`;
  const songsRes = await fetch(songsUrl, { headers });
  if (songsRes.ok) {
    const songsData = await songsRes.json();
    const documents = songsData.documents || [];
    console.log(`Found ${documents.length} songs in DB to permanently delete.`);
    for (const doc of documents) {
      const docName = doc.name;
      const songId = docName.split("/").pop();

      // Deleting nested votes subcollection first
      console.log(`Listing votes subcollection for song ${songId}...`);
      const votesUrl = `${baseUrl}/songs/${songId}/votes?pageSize=500`;
      const votesRes = await fetch(votesUrl, { headers });
      if (votesRes.ok) {
        const votesData = await votesRes.json();
        const voteDocs = votesData.documents || [];
        console.log(`Found ${voteDocs.length} vote records for song ${songId}. deleting them first...`);
        for (const voteDoc of voteDocs) {
          console.log(`Deleting vote document: ${voteDoc.name}`);
          await fetch(`https://firestore.googleapis.com/v1/${voteDoc.name}`, {
            method: "DELETE",
            headers
          });
        }
      }

      console.log(`Deleting song document: ${docName}`);
      const deleteRes = await fetch(`https://firestore.googleapis.com/v1/${docName}`, {
        method: "DELETE",
        headers
      });
      if (deleteRes.ok) {
        console.log(`Successfully deleted song: ${songId}`);
      } else {
        console.error(`Failed to delete song ${songId}:`, deleteRes.status, await deleteRes.text());
      }
    }
  } else {
    console.error("Failed to list songs:", songsRes.status, await songsRes.text());
  }

  console.log("Administrative REST API purge completed successfully!");
}

main().catch(console.error);
