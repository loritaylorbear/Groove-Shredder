function toolbarMagic(){
   // Read preferences
	var nsIPrefServiceObj = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService);
	var nsIPrefBranchObj = nsIPrefServiceObj.getBranch("extensions.grooveshredder");

	if(!nsIPrefBranchObj.prefHasUserValue("firstrun"))
	{
		var gsId    = "grooveshredder-toolbar-button";
		var beforeId = "urlbar-container";
		var navBar  = document.getElementById("nav-bar");
		var curSet  = navBar.currentSet.split(",");

		if (curSet.indexOf(gsId) == -1) {
			var pos = curSet.indexOf(beforeId) - 1 || curSet.length;
			var set = curSet.slice(0, pos).concat(gsId).concat(curSet.slice(pos));

			navBar.setAttribute("currentset", set.join(","));
			navBar.currentSet = set.join(",");
			document.persist(navBar.id, "currentset");
			try {
			  BrowserToolboxCustomizeDone(true);
			}
			catch (e) {}
		}
	}
	
	nsIPrefBranchObj.setBoolPref("firstrun",true);
	window.removeEventListener("load", toolbarMagic, false);
}

window.addEventListener("load", toolbarMagic, false);
