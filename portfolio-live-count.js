/* Live account total and clearly labelled filtered snapshot, never a frozen hero number. */
(() => {
 const output=document.getElementById('repositorySummary');if(!output)return;
 const safeGet=async url=>{const response=await fetch(url,{cache:'no-cache',signal:AbortSignal.timeout(7000)});if(!response.ok)throw new Error('Metadata unavailable');return response.json()};
 Promise.allSettled([safeGet('https://api.github.com/users/Biswajit1999'),safeGet('data/public-repositories.json')]).then(([account,snapshot])=>{
  const total=account.status==='fulfilled'&&Number.isInteger(account.value.public_repos)?account.value.public_repos:null;
  const saved=snapshot.status==='fulfilled'&&Array.isArray(snapshot.value)?snapshot.value.length:null;
  output.textContent=total!==null
   ? 'GitHub: '+total+' public repositories'+(saved!==null?' · saved catalogue: '+saved+' active, non-fork projects.':'.')
   : saved!==null?'Saved catalogue: '+saved+' active, non-fork projects. Live account total is temporarily unavailable.':'Browse the current catalogue and GitHub profile.';
  output.dataset.source=total!==null?'github-live':'saved-snapshot';
 });
})();
