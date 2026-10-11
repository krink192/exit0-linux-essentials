# SPDX-License-Identifier: AGPL-3.0-or-later
from common import S, F

# ---------------- 1.1 Linux Evolution and Popular Operating Systems (12) ----------------
S("1.1", "Ubuntu is derived from which distribution?",
  ["✔Debian", "Fedora", "openSUSE", "Slackware"],
  "Ubuntu is built from Debian packages and uses Debian's .deb format and APT tools. Fedora is Red Hat's community distribution, openSUSE comes from SUSE, and Slackware is an independent early distribution.")
S("1.1", "Which mobile operating system is built on a modified Linux kernel?",
  ["✔Android", "iOS", "Windows 10 Mobile", "BlackBerry 10"],
  "Android runs a modified Linux kernel with its own userspace. iOS uses Apple's XNU kernel (Darwin), Windows 10 Mobile uses the Windows NT kernel, and BlackBerry 10 is built on QNX.")
S("1.1", "Which distributions belong to the Red Hat family and use RPM packages?",
  ["✔CentOS", "✔Scientific Linux", "Linux Mint", "Raspbian", "Ubuntu"],
  "CentOS and Scientific Linux were both rebuilt from Red Hat Enterprise Linux source code and use RPM packages. Linux Mint is based on Ubuntu, and Ubuntu and Raspbian are based on Debian, so they all use .deb packages.")
S("1.1", "Why are Linux images the most common choice for virtual machines on public cloud platforms?",
  ["✔No per-VM license fee, and it runs well as a lean server guest",
   "Public cloud platforms do not allow any other operating system to run",
   "Only Linux can run as a guest inside a virtual machine",
   "Linux VMs include a full graphical desktop by default"],
  "Linux can run on thousands of instances without license costs, and minimal server installs use few resources. Clouds such as Azure and AWS also offer Windows VMs, many operating systems can be virtualized, and cloud VMs usually run without a desktop.")
S("1.1", "Raspbian is a distribution customized for the Raspberry Pi. Which distribution is it based on?",
  ["✔Debian", "Red Hat Enterprise Linux", "openSUSE", "Android"],
  "Raspbian (now called Raspberry Pi OS) is a Debian-family distribution built for the Pi's ARM processor, so it uses .deb packages and APT.")
S("1.1", "A Raspberry Pi has no built-in hard disk. What does it normally boot its operating system from?",
  ["✔A microSD card", "An internal SATA hard disk", "An image stored in its BIOS chip", "A DVD in an attached drive"],
  "The Pi boots from a (micro)SD card, which Linux names /dev/mmcblk0 with partitions such as /dev/mmcblk0p1. It has no SATA disk or traditional BIOS.")
S("1.1", "Which is the best description of an embedded system?",
  ["✔Hardware and software built for a dedicated job inside a larger device",
   "A virtual machine that runs inside a cloud provider's data center",
   "A Linux distribution that is installed next to Windows on the same hard disk",
   "A program that is compiled directly into the Linux kernel source"],
  "Embedded systems are purpose-built computers inside things like cars, routers, TVs and medical devices. Linux is popular there because it has no license fees and supports many vendors' hardware. Android and Raspbian are the embedded examples LPI names.")
F("1.1", "Type the package file extension used by Debian, Ubuntu and Linux Mint, without the dot.",
  ["deb", ".deb"],
  "Debian-family distributions use .deb packages, managed with dpkg and apt-get/apt. Red Hat-family distributions (RHEL, CentOS, Fedora, Scientific Linux) use .rpm packages, managed with rpm and yum/dnf.")
S("1.1", "Which configuration tool is closely associated with SUSE Linux Enterprise and openSUSE?",
  ["✔YaST", "Synaptic", "dpkg-reconfigure", "Kickstart"],
  "YaST (Yet another Setup Tool) is SUSE's system configuration tool. Synaptic is a graphical APT front end and dpkg-reconfigure reconfigures Debian packages, so both belong to the Debian family. Kickstart automates Red Hat installations.")
S("1.1", "The main edition of Linux Mint is based on which distribution?",
  ["✔Ubuntu", "Fedora", "openSUSE", "CentOS"],
  "Linux Mint's main edition is built on Ubuntu (which is built on Debian), so it uses .deb packages. A separate edition, LMDE, is based directly on Debian.")
S("1.1", "How often does Ubuntu publish a Long Term Support (LTS) release?",
  ["✔Every two years", "Every six months", "Every year", "Every five years"],
  "Ubuntu releases a new version every six months (numbered YY.MM, such as 24.04), and every second April release, once every two years, is an LTS release with five years of standard support.")
S("1.1", "Which statements about Debian and Ubuntu are true?",
  ["✔Ubuntu is built from Debian and uses .deb packages",
   "✔Both use dpkg and APT tools to manage software",
   "Ubuntu uses RPM packages and the yum tool",
   "Debian is developed and owned by Canonical",
   "Debian releases a new stable version every six months"],
  "Ubuntu is a Debian derivative, so both use dpkg and APT. Canonical (Mark Shuttleworth's company) maintains Ubuntu, while Debian is a volunteer community project with a slower, stability-focused release cycle.")

# ---------------- 1.2 Major Open Source Applications (12) ----------------
S("1.2", "A small office wants to replace Microsoft Office with an open source suite that can edit .docx and .xlsx files. Which application fits best?",
  ["✔LibreOffice", "GIMP", "Thunderbird", "Nextcloud"],
  "LibreOffice includes Writer (text), Calc (spreadsheets) and Impress (presentations) and opens Microsoft Office formats, though its native format is ODF. GIMP edits images, Thunderbird is an email client, and Nextcloud is a self-hosted file sync and collaboration server.")
F("1.2", "On a Debian-based system, type the low-level package tool used to install a downloaded .deb file directly (command name only).",
  ["dpkg", "dpkg -i"],
  "`dpkg -i package.deb` installs a local .deb file but does not fetch missing dependencies. `apt-get` and `apt` work with repositories and resolve dependencies. The RPM-family equivalents are `rpm` (low-level) and `yum` or `dnf` (repository-aware).")
S("1.2", "Which applications are web servers?",
  ["✔Apache HTTPD", "✔NGINX", "MariaDB", "Samba", "Thunderbird"],
  "Apache HTTPD and NGINX serve web pages over HTTP/HTTPS. MariaDB is a relational database (a fork of MySQL), Samba provides Windows-compatible SMB file and print sharing, and Thunderbird is an email client.")
S("1.2", "On CentOS, which tool installs a package from a repository and automatically resolves its dependencies?",
  ["✔yum", "rpm", "dpkg", "apt-get"],
  "`yum` (and its successor `dnf`) downloads packages from repositories and pulls in dependencies. `rpm` installs local .rpm files without resolving dependencies. `dpkg` and `apt-get` belong to the Debian family.")
S("1.2", "Windows users need to map a Linux server's folders as network drives in File Explorer. Which software provides this?",
  ["✔Samba", "NFS", "NGINX", "MariaDB"],
  "Samba implements the SMB/CIFS protocol that Windows uses for file and printer sharing, and Samba 4 can even act as an Active Directory domain controller. NFS is the native Unix/Linux file sharing protocol, NGINX is a web server, and MariaDB is a database.")
F("1.2", "Type the three-letter name of the traditional protocol for sharing directories between Linux and Unix systems.",
  ["NFS", "nfs"],
  "NFS (Network File System) lets Linux and Unix machines mount directories exported by another machine. To share with Windows clients you would normally use Samba (SMB) instead.")
S("1.2", "A team wants a self-hosted alternative to Dropbox that syncs files and also handles calendars and contacts. Which applications fit?",
  ["✔Nextcloud", "✔ownCloud", "Samba", "MariaDB", "Thunderbird"],
  "Nextcloud and ownCloud (Nextcloud is a fork of ownCloud) are PHP web applications that provide file sync, sharing, calendars and contacts, with desktop and mobile clients. Samba shares files but has no sync, calendar or web interface. MariaDB is a database, and Thunderbird is a mail client.")
S("1.2", "MariaDB was created as a community-developed fork of which database?",
  ["✔MySQL", "PostgreSQL", "SQLite", "Oracle Database"],
  "MariaDB was forked from MySQL after Oracle acquired it, and it remains largely compatible. PostgreSQL is a separate open source relational database. SQLite is an embedded, file-based database, and Oracle Database is proprietary.")
S("1.2", "Which languages are normally run by an interpreter rather than compiled ahead of time?",
  ["✔Python", "✔Perl", "C", "Java", "Go"],
  "Python and Perl scripts are executed by an interpreter each time they run, like shell scripts and PHP. C and Go compile to native machine code, and Java compiles to bytecode that runs on the Java Virtual Machine.")
S("1.2", "In a LAMP stack, which language typically generates dynamic web pages on the server?",
  ["✔PHP", "Bash", "C", "Java"],
  "LAMP stands for Linux, Apache, MySQL/MariaDB and PHP. PHP runs on the server to build pages, often pulling data from the database. JavaScript, by contrast, mainly runs in the visitor's browser.")
S("1.2", "LibreOffice was created as a fork of which project?",
  ["✔OpenOffice.org", "Microsoft Office", "Google Docs", "Calligra Suite"],
  "OpenOffice.org was the open source version of Sun's StarOffice. LibreOffice was forked from it by The Document Foundation, while OpenOffice.org itself became Apache OpenOffice. Most distributions ship LibreOffice by default.")
S("1.2", "Which open source application edits raster images such as JPEG and PNG photos, similar to Photoshop?",
  ["✔GIMP", "Inkscape", "Blender", "Audacity"],
  "GIMP is the open source raster (bitmap) image editor. Inkscape edits vector graphics (SVG), Blender does 3D modelling and animation, and Audacity edits audio.")

# ---------------- 1.3 Open Source Software and Licensing (6) ----------------
S("1.3", "You release a program and want every modified version that others distribute to stay free software with source code available. Which license should you choose?",
  ["✔GNU GPL version 3", "2-Clause BSD License", "MIT License", "Creative Commons BY"],
  "The GPL is a copyleft license: anyone who distributes a modified version must use the same terms and provide the source. BSD and MIT are permissive, so others may keep their changes closed. CC BY is also permissive (attribution only) and is meant for creative works, not software.")
S("1.3", "Which organization maintains the Open Source Definition and approves licenses as open source?",
  ["✔Open Source Initiative (OSI)", "Free Software Foundation (FSF)", "The Linux Foundation", "Apache Software Foundation"],
  "The OSI, founded in 1998 by Eric S. Raymond and Bruce Perens, reviews licenses against the Open Source Definition. The FSF, founded by Richard Stallman in 1985, promotes the four freedoms of free software and publishes the GPL.")
S("1.3", "Which of the FSF's four freedoms require access to the source code?",
  ["✔Freedom to study how the program works and change it",
   "✔Freedom to distribute copies of your modified versions",
   "Freedom to run the program for any purpose",
   "Freedom to redistribute exact copies to help others",
   "Freedom to charge a license fee for each copy"],
  "Freedoms 0 to 3 are: run the program for any purpose (0), study and change it (1), redistribute copies (2), and distribute modified versions (3). Studying, changing and sharing changes (1 and 3) are impossible without the source. Charging fees is allowed, but it is not one of the freedoms.")
S("1.3", "Which Creative Commons license places the most restrictions on reuse?",
  ["✔CC BY-NC-ND", "CC BY", "CC BY-SA", "CC BY-NC"],
  "BY requires attribution, SA (ShareAlike) requires the same license on derivatives, NC forbids commercial use, and ND (NoDerivatives) forbids modified versions. BY-NC-ND combines the most limits. Plain CC BY is the most permissive.")
F("1.3", "Type the acronym that stands for Free/Libre and Open Source Software.",
  ["FLOSS", "floss"],
  "FLOSS adds 'Libre' to make clear that 'free' means freedom, not price. FOSS (Free and Open Source Software) is the shorter variant. Both terms cover the free software and open source movements together.")
S("1.3", "A company publishes its software under the GPL and also sells a commercial license to customers who want to keep their modifications private. What is this business model called?",
  ["✔Dual licensing", "Copyleft enforcement", "Shareware", "Software as a Service"],
  "Dual licensing offers the same code under an open source license and a paid proprietary license. Other open source business models LPI lists are support and consulting, SaaS hosting, crowdfunding, merchandising, certification and custom development.")

# ---------------- 1.4 ICT Skills and Working in Linux (12) ----------------
S("1.4", "Which practice gives the best protection when you have accounts on many websites?",
  ["✔Use a password manager and a unique password for each site",
   "Use one strong password everywhere and change it once every year",
   "Store your passwords in a text file in your home folder",
   "Use short passwords that are easy to type and remember"],
  "Unique passwords limit the damage when one site is breached, and a password manager such as KeePass or Bitwarden makes long random passwords practical behind a single master password. Reusing a password exposes every account after a single leak.")
S("1.4", "Which browser settings reduce how much websites can track you?",
  ["✔Blocking third-party cookies", "✔Using a private (incognito) window",
   "Turning on password autofill on a shared computer", "Allowing every site to send notifications",
   "Disabling HTTPS-only mode"],
  "Blocking third-party cookies stops cross-site ad trackers, and private windows discard cookies and history when closed. Autofill on a shared machine and permissive notifications weaken privacy, and HTTPS-only mode protects your traffic, so turning it off makes things worse.")
S("1.4", "On many Linux desktops, which key combination switches from the graphical session to a text-mode virtual console?",
  ["✔Ctrl+Alt+F3", "Ctrl+Alt+Delete", "Alt+Tab", "Ctrl+Shift+T"],
  "Ctrl+Alt+F1 through F6 (or F7) switch between virtual consoles (TTYs), and which number hosts the graphical session varies by distribution. Ctrl+Alt+Delete is a reboot or logout shortcut, Alt+Tab switches windows, and Ctrl+Shift+T opens a new tab in many terminal emulators.")
S("1.4", "A coworker needs to build slides for a project meeting using only open source software. Which application should they use?",
  ["✔LibreOffice Impress", "LibreOffice Calc", "GIMP", "Firefox"],
  "Impress is LibreOffice's presentation program, comparable to PowerPoint, and its native format is ODP. Calc is the spreadsheet. GIMP edits images (useful for graphics, not the slides themselves), and Firefox is a web browser.")
S("1.4", "What does a private (incognito) browser window do?",
  ["✔Discards history, cookies and form data when it is closed",
   "Hides your IP address from the websites that you visit",
   "Encrypts all traffic between your computer and websites",
   "Stops your employer's network from seeing sites you visit"],
  "Private browsing only avoids leaving traces on the local computer. Websites, your ISP and your network administrator can still see your traffic. Encryption comes from HTTPS (TLS), and hiding your IP address requires something like a VPN or Tor.")
S("1.4", "What is true about the Do Not Track (DNT) browser setting?",
  ["✔It asks sites not to track you, but sites may ignore it",
   "It blocks all third-party cookies on every site you visit",
   "It encrypts your browsing history stored on the disk",
   "It is legally binding on websites in every country"],
  "DNT just sends an HTTP header (`DNT: 1`) requesting no tracking. Honoring it is voluntary, so it guarantees nothing. Blocking third-party cookies is a separate setting.")
S("1.4", "What is a terminal emulator such as GNOME Terminal or Konsole?",
  ["✔A graphical program that gives you a shell inside a window",
   "The physical keyboard and monitor attached to a server",
   "A program that converts your shell scripts into compiled binary files",
   "A remote desktop client used to manage Windows servers"],
  "Terminal emulators imitate the old hardware terminals inside the desktop and run a shell such as Bash. A text virtual console (TTY, reached with Ctrl+Alt+F-keys) provides a shell without any graphical environment.")
S("1.4", "A company rents virtual machines from a cloud provider and installs and patches the operating system itself. Which cloud service model is this?",
  ["✔Infrastructure as a Service (IaaS)", "Platform as a Service (PaaS)", "Software as a Service (SaaS)", "Storage as a Service (STaaS)"],
  "With IaaS (such as Azure VMs or AWS EC2) you manage everything from the OS up. With PaaS (such as Heroku or Azure App Service) the provider manages the OS and you deploy code. With SaaS (such as Dropbox or Salesforce) you just use the finished application.")
F("1.4", "Type the three-letter acronym for the hypervisor that is built into the Linux kernel.",
  ["KVM", "kvm"],
  "KVM (Kernel-based Virtual Machine) turns the Linux kernel into a hypervisor and is widely used in clouds and by Red Hat. Other hypervisors LPI mentions are Xen (the oldest) and VirtualBox (Oracle, popular on desktops). OpenStack builds private IaaS clouds on top of them.")
S("1.4", "What does HTTPS add to a normal web connection?",
  ["✔TLS encryption plus verification of the site's certificate",
   "A guarantee that the website and its downloads contain no malware",
   "Anonymity, so the website cannot see your IP address",
   "Faster page loading through compressed image delivery"],
  "HTTPS is HTTP over TLS (the successor to SSL). It encrypts traffic and lets the browser check the site's certificate, shown by the padlock. It says nothing about whether the site itself is trustworthy, and it does not hide your IP address.")
S("1.4", "Which of these passwords is the strongest?",
  ["✔Tr4in-Lamp-Orbit-Cactus", "Password123!", "qwertyuiop", "Fluffy2019"],
  "Length and unpredictability matter most. A passphrase of several unrelated words is long and hard to guess. Password123!, keyboard patterns like qwertyuiop, and pet names with years all appear in attackers' wordlists.")
S("1.4", "In Firefox, which keyboard shortcut opens a new private window?",
  ["✔Ctrl+Shift+P", "Ctrl+Shift+N", "Ctrl+Shift+T", "Ctrl+P"],
  "Firefox uses Ctrl+Shift+P for a private window. Ctrl+Shift+N does the same in Chrome and Chromium, Ctrl+Shift+T reopens the last closed tab, and Ctrl+P prints.")
