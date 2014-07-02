# cloudDAV

Based upon Mike Deboer's excellent [jsDAV](https://github.com/mikedeboer/jsDAV)  
With plugin enhancements to make the webgui more usable as a "cloud" frontened.  

The entire subset of jsDAV's backend remains unchanged so all functionality remains.  

## Modifications by The Insomniac  
###Enhancements for a more "cloud storage"-like interface.  

* Major overhaul to the page displayed via a browser
  * Modern look and feel with mime type icons and modals for creating new files  
* Added context menu for:  
  * Download  
  * Copy  
  * Rename/Move  
* Added image preview modal  
* Moved all html creation from the JavaScript source to an external handlebars template.  
  * If anyone can suggest something a little bit faster then please do!  

![Main](https://raw.githubusercontent.com/TheInsomniac/cloudDAV/master/lib/assets/screenshots/cloudDav1.png)  
![Folder](https://raw.githubusercontent.com/TheInsomniac/cloudDAV/master/lib/assets/screenshots/cloudDav2.png)  
![Upload](https://raw.githubusercontent.com/TheInsomniac/cloudDAV/master/lib/assets/screenshots/cloudDav3.png)  
![Context](https://raw.githubusercontent.com/TheInsomniac/cloudDAV/master/lib/assets/screenshots/cloudDav4.png)  

#### HTDIGEST:  
If you need a way to generate the htdigest file but do not have apache or apache utils  
installed then try [Node htdigest](https://github.com/gevorg/htdigest).
