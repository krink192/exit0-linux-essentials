# SPDX-License-Identifier: AGPL-3.0-or-later
from common import S, F

# ---------------- 4.1 Choosing an Operating System (6) ----------------
S("4.1", "What does an LTS (Long Term Support) release of a distribution such as Ubuntu offer?",
  ["✔Security and maintenance updates for several years", "The newest features every few months, with short support",
   "A paid-only edition with no community packages", "A beta version for testing upcoming changes"],
  "LTS releases trade newer features for stability and a long maintenance window (five years of standard support for Ubuntu LTS, and about ten years for RHEL), which suits servers and businesses. Interim releases ship newer software with shorter support, and beta releases are pre-release test builds.")
S("4.1", "A distribution labels an upcoming release as \"beta\". What does this tell you?",
  ["✔It is a test release that may have bugs and isn't meant for production", "It is the long-term support release",
   "It has reached end of life and will not receive any more security updates", "It is the stable version recommended for servers"],
  "Beta releases let users test upcoming changes before the stable release. Stable releases are for production, LTS releases add a long support window, and end-of-life releases no longer get security updates.")
S("4.1", "Which statement about macOS compared with Linux is true?",
  ["✔macOS is proprietary and built on a BSD-derived Unix base (Darwin)", "macOS runs on a customized Linux kernel with Apple's own desktop on top",
   "macOS is released under the GNU General Public License", "macOS has no command-line shell or terminal at all"],
  "macOS (formerly OS X) is Apple's proprietary system on the Darwin core, which includes BSD Unix components, so `uname -s` prints Darwin. It ships Terminal with a Unix shell (zsh by default today, Bash previously). Linux is a separate, GPL-licensed kernel.",
  run=None)
S("4.1", "A distribution such as Arch Linux delivers updates continuously instead of in numbered versions. What is this model called?",
  ["✔Rolling release", "Long Term Support", "Point release", "Beta channel"],
  "Rolling-release distributions (Arch, Gentoo, openSUSE Tumbleweed) always track the latest software, which brings new features quickly but with more risk of breakage. Fixed or point releases (Debian, Ubuntu, RHEL) freeze versions and backport security fixes.")
S("4.1", "Which statement correctly compares Windows and Linux?",
  ["✔Windows is proprietary and licensed; Linux is free to use and modify", "Linux requires a paid license for each server, while Windows Server is free",
   "Windows source code is published under the GNU GPL", "Linux offers only a command line and has no GUI at all"],
  "Windows is closed source and licensed per device or core. Linux distributions are generally free (as in freedom and usually price), though enterprise subscriptions such as RHEL charge for support. Linux offers many desktop environments, such as GNOME and KDE, and both systems can run without a GUI on servers.")
S("4.1", "Why should you avoid running a distribution release that has reached end of life (EOL)?",
  ["✔It no longer receives security updates or bug fixes", "The system stops booting as soon as the end-of-life date passes",
   "Its installed packages are deleted from the disk", "It can no longer start a graphical desktop"],
  "After EOL the maintainers stop publishing patches, so newly discovered vulnerabilities stay open. The system keeps running, which is exactly why unpatched EOL servers are a common security risk. Plan upgrades before EOL.")

# ---------------- 4.2 Understanding Computer Hardware (12) ----------------
F("4.2", "A system has two SATA disks. Type the device file (full path) for the first partition on the second disk.",
  ["/dev/sdb1"],
  "Disks are named /dev/sda, /dev/sdb, /dev/sdc and so on in detection order, and partitions are numbered, so /dev/sdb1 is partition 1 on the second disk. NVMe drives use names like /dev/nvme0n1p1, and SD cards use /dev/mmcblk0p1.")
S("4.2", "Which statement correctly compares a solid state drive (SSD) with a hard disk drive (HDD)?",
  ["✔An SSD has no moving parts and usually has much faster access", "An SSD loses all of its stored data whenever the power is turned off",
   "An HDD stores its data in flash memory chips", "An SSD cannot be divided into partitions"],
  "SSDs use non-volatile flash memory, so data persists without power, and having no spinning platters gives faster random access, lower power use and better shock resistance. HDDs use magnetic platters and cost less per gigabyte. Both can be partitioned.")
S("4.2", "What is the job of a device driver on a Linux system?",
  ["✔It lets the kernel communicate with a specific piece of hardware", "It stores the user's desktop and display settings",
   "It decides which process runs on each CPU core and for how long it runs", "It converts AC power into DC power for components"],
  "Drivers, often loadable kernel modules, translate the kernel's standard requests into device-specific commands for hardware such as network cards or GPUs. Process scheduling is a core kernel function, and the power supply unit converts AC to DC.")
S("4.2", "What does the device file /dev/sda3 refer to?",
  ["✔The third partition on the first SCSI/SATA disk", "The first partition on the third SCSI/SATA disk drive",
   "The third disk detected on the system", "The third USB port on the motherboard"],
  "The letter identifies the disk (a is first, b second, c third), and the number identifies the partition on that disk. The third partition of the third disk would be /dev/sdc3.")
S("4.2", "Which component converts wall-outlet AC power into the DC voltages that computer components need?",
  ["✔Power supply unit (PSU)", "Motherboard chipset", "UEFI firmware", "CPU heat sink"],
  "The PSU supplies stable DC voltages. Servers often have redundant PSUs connected to separate power sources. Heat sinks and fans remove heat, and the firmware initializes the hardware at power-on.")
S("4.2", "Which firmware standard replaced the legacy BIOS on most modern motherboards?",
  ["✔UEFI", "GRUB", "POST", "CMOS"],
  "UEFI (Unified Extensible Firmware Interface) initializes the hardware and starts the boot loader. People still often call it \"BIOS\". GRUB is the Linux boot loader that runs after the firmware, POST is the power-on self-test, and CMOS is the small memory that stores firmware settings.")
S("4.2", "Which statement about 32-bit and 64-bit systems is true?",
  ["✔A 64-bit system can run 32-bit programs, but not the reverse", "A 32-bit system can run 64-bit programs, but not the reverse",
   "ARM processors run x86-64 programs natively without emulation", "A 32-bit system can directly address 64 GB of RAM"],
  "64-bit CPUs (x86-64/AMD64) support 32-bit code for compatibility, but a 32-bit CPU cannot run 64-bit instructions. A plain 32-bit system can address about 4 GB of memory. ARM is a different instruction set from x86.")
F("4.2", "Type the command that lists block devices, such as disks and their partitions, in a tree.",
  ["lsblk"],
  "`lsblk` shows each disk with its partitions, sizes and mount points, and `lsblk -f` adds filesystem types. You can also view the device files directly with `ls /dev/sd*`.",
  run="command -v {A} >/dev/null && echo ok", expect="ok")
S("4.2", "Why might an administrator put /home on its own partition?",
  ["✔User data survives an OS reinstall and can't fill up the root filesystem", "Linux will not boot unless /home has its own partition",
   "Files stored on a separate partition load faster than files on the root one", "It is the only way to give each user a home directory"],
  "Separating /home isolates user data: you can reinstall or upgrade the OS without touching it, and a user filling their space can't exhaust the root filesystem. It is optional, and partitions on the same disk give no performance gain or fault tolerance.")
S("4.2", "On a typical Linux system, which device file represents the first SATA optical (DVD) drive?",
  ["✔/dev/sr0", "/dev/sda0", "/dev/opt0", "/dev/hdz9"],
  "Optical drives use the SCSI CD-ROM driver and appear as /dev/sr0, /dev/sr1 and so on, often with a /dev/cdrom symbolic link. Partition numbers start at 1, so /dev/sda0 never exists.")
S("4.2", "On a Raspberry Pi, what is the usual device name for the first partition of the SD card?",
  ["✔/dev/mmcblk0p1", "/dev/sda1", "/dev/sd0p1", "/dev/mmc1"],
  "SD and eMMC cards use the mmcblk prefix: mmcblk0 is the card, and p1 and p2 are its partitions (usually a small vfat /boot and an ext4 root). Only SCSI/SATA-style devices use the /dev/sdX naming without a p.")
S("4.2", "Which commands show information about the system's CPU?",
  ["✔lscpu", "✔cat /proc/cpuinfo", "lsblk", "free -h", "uname -n"],
  "`lscpu` summarizes architecture, cores and cache, and /proc/cpuinfo lists details for each logical CPU. `lsblk` lists block devices, `free` shows memory, and `uname -n` prints the hostname.",
  run="lscpu >/dev/null && grep -qc processor /proc/cpuinfo && echo ok", expect="ok")

# ---------------- 4.3 Where Data is Stored (18) ----------------
S("4.3", "In which directory are most system log files stored?",
  ["✔/var/log/", "/etc/log/", "/proc/log/", "/usr/log/"],
  "/var holds variable data that changes while the system runs, and /var/log/ holds logs such as syslog, messages, auth.log and kern.log. /etc is for configuration, and /proc is a virtual filesystem for kernel and process data.")
F("4.3", "Type the command that prints the kernel ring buffer, including hardware detection messages from boot.",
  ["dmesg", "sudo dmesg"],
  "`dmesg` shows messages the kernel logged, such as detected disks and USB devices, and it is often piped to less or grep. On systemd systems `journalctl -k` (or `--dmesg`) shows the same kernel messages.")
S("4.3", "Which commands display how much memory (RAM) is in use?",
  ["✔free", "✔top", "df", "du", "lsblk"],
  "`free` summarizes RAM and swap, and `top` shows memory totals in its header plus per-process usage. `df` reports filesystem disk space, `du` reports disk usage of files and directories, and `lsblk` lists block devices.")
S("4.3", "Which directory is a virtual filesystem the kernel generates to expose information about running processes and system state?",
  ["✔/proc/", "/boot/", "/etc/", "/var/"],
  "/proc exists only in memory. /proc/cpuinfo describes the CPU, /proc/meminfo memory, and /proc/<PID>/ each process. /sys is a similar virtual filesystem for devices. /boot, /etc and /var live on disk.")
F("4.3", "Type the directory (full path) that holds the Linux kernel image (vmlinuz) and the initial RAM disk.",
  ["/boot", "/boot/"],
  "/boot contains vmlinuz-<version>, initrd.img or initramfs, System.map, the kernel config and the GRUB boot loader files. It is often a small separate partition.",
  run="test -d {A} && echo ok", expect="ok")
S("4.3", "Which commands display information about running processes?",
  ["✔ps", "✔top", "free", "dmesg", "host"],
  "`ps` prints a snapshot of processes (`ps aux` shows all of them), and `top` shows a live, refreshing view. `free` shows memory, `dmesg` shows kernel messages, and `host` performs DNS lookups.")
S("4.3", "What happens to data written to /dev/null?",
  ["✔It is discarded", "It is kept in memory until the next reboot", "It is sent to the default printer", "It is logged to /var/log/null"],
  "/dev/null is a character device that throws away everything written to it and returns nothing when read. It is commonly used to hide output, as in `command 2>/dev/null`.",
  run="echo hi > /dev/null; wc -c < /dev/null", expect="0")
S("4.3", "In `ls -l /dev/sda`, the line starts with the letter b. What does that mean?",
  ["✔The file is a block device", "The file is a binary executable", "The file is a broken symbolic link", "The file is a backup copy"],
  "The first character shows the file type: `-` regular file, `d` directory, `l` symbolic link, `b` block device (disks), `c` character device (terminals, /dev/null), `s` socket and `p` named pipe.",
  run="ls -l /dev/null | cut -c1", expect="c")
F("4.3", "Type the directory (full path) where system-wide configuration files such as hosts, passwd and resolv.conf are stored.",
  ["/etc", "/etc/"],
  "/etc holds plain-text configuration files for the system and its services. Per-user settings live in hidden dotfiles in each home directory, such as ~/.bashrc.",
  run="test -f {A}/passwd && echo ok", expect="ok")
S("4.3", "On most modern Linux distributions, which program runs as process ID 1?",
  ["✔systemd", "bash", "cron", "sshd"],
  "The kernel starts PID 1, which then starts every other service. Today this is usually systemd, which replaced SysV init. You can check with `ps -p 1`.")
S("4.3", "Which command lists every process on the system, including other users' processes and their owners?",
  ["✔ps aux", "ps", "who -a", "free -t"],
  "Plain `ps` shows only processes in your current terminal session. `ps aux` (BSD-style) or `ps -ef` shows everything, with the user, PID, CPU and memory use, and the command. `who` lists logins, and `free` shows memory.",
  run="ps aux | head -1 | awk '{print $1, $2}'", expect="USER PID")
S("4.3", "While top is running, which key sorts the process list by memory usage?",
  ["✔M", "P", "k", "q"],
  "In top, `M` sorts by memory, `P` sorts by CPU (the default), `k` kills a process by PID, and `q` quits. The summary area at the top shows uptime, load, tasks, CPU, memory and swap.")
F("4.3", "Type the free option (a dash and one letter) that shows sizes in human-readable units such as Gi and Mi.",
  ["-h", "--human"],
  "`free -h` picks readable units automatically. `-m` shows mebibytes, `-g` gibibytes, and `-b` bytes. Without options free reports kibibytes. The available column estimates how much memory new programs can use.",
  run="free {A} | grep -c Mem", expect="1")
S("4.3", "What is swap space?",
  ["✔Disk space used as overflow when RAM is full", "Fast cache memory built into the CPU",
   "A reserved backup copy of the /boot partition's files", "Memory set aside for the graphics card"],
  "When RAM runs short, the kernel moves idle memory pages to swap (a partition or file) and brings them back when needed. Swap is much slower than RAM. `free` and `top` both show swap usage.")
S("4.3", "On a systemd-based system, which command shows the log messages of the ssh service?",
  ["✔journalctl -u ssh.service", "dmesg -u ssh.service", "tail /proc/ssh/log", "systemctl --logs ssh"],
  "journald stores logs in binary form, so you read them with journalctl. `-u` filters by unit, `-f` follows new entries, `-b` shows the current boot, and `-k` shows kernel messages. dmesg reads only the kernel ring buffer.")
S("4.3", "On Debian or Ubuntu, which log file records sudo usage and login attempts?",
  ["✔/var/log/auth.log", "/var/log/kern.log", "/var/log/dpkg.log", "/var/log/boot.log"],
  "auth.log holds authentication events such as sudo, su, SSH logins and failures. Red Hat-family systems use /var/log/secure instead. kern.log holds kernel messages, and dpkg.log records package installs.")
S("4.3", "Which virtual filesystem presents devices and drivers in an organized tree, such as the network interfaces in class/net?",
  ["✔/sys", "/dev", "/boot", "/srv"],
  "sysfs (/sys), introduced with kernel 2.6, organizes hardware information by bus, class and device. For example, /sys/class/net/eth0/address holds that interface's MAC address. /dev contains the device files used to access the hardware.",
  run="test -d /sys/class/net && echo ok", expect="ok")
S("4.3", "Which command shows new lines as they are written to /var/log/syslog?",
  ["✔tail -f /var/log/syslog", "head -f /var/log/syslog", "cat -f /var/log/syslog", "less -n /var/log/syslog"],
  "`tail -f` (follow) keeps the file open and prints new lines as they arrive. Press Ctrl+C to stop. `journalctl -f` does the same for the systemd journal. head and cat have no follow mode.")

# ---------------- 4.4 Your Computer on the Network (12) ----------------
S("4.4", "Which file lists the DNS name servers that the system's resolver queries?",
  ["✔/etc/resolv.conf", "/etc/hosts", "/etc/hostname", "/etc/networks"],
  "/etc/resolv.conf contains `nameserver` lines (and often `search` domains). /etc/hosts maps names to addresses locally and is usually checked before DNS. /etc/hostname holds the machine's own name.")
S("4.4", "Which IPv4 address belongs to a private address range?",
  ["✔172.20.4.9", "172.32.1.1", "192.169.0.5", "8.8.8.8"],
  "The private ranges are 10.0.0.0/8, 172.16.0.0/12 (172.16.0.0 to 172.31.255.255) and 192.168.0.0/16. 172.20.4.9 is inside 172.16.0.0/12. 172.32.1.1 is just outside it, 192.169.x.x is not 192.168, and 8.8.8.8 is Google's public DNS server.")
F("4.4", "Type the iproute2 command that shows the IP addresses assigned to all network interfaces.",
  ["ip addr show", "ip addr", "ip a", "ip address show", "ip address", "ip a show", "ip addr list", "ip address list", "ip a s"],
  "`ip addr show` (short form `ip a`) replaces the older `ifconfig`. `ip route show` displays the routing table, and `ss` (replacing `netstat`) shows sockets.",
  run=None)
S("4.4", "Which of these is a valid IPv6 address?",
  ["✔2001:db8::1", "2001::db8::1", "2001:db8:g::1", "192.168.1.300"],
  "IPv6 addresses are 128 bits written as eight groups of hexadecimal digits. `::` may replace one run of zero groups only once, so 2001::db8::1 is invalid. `g` is not a hexadecimal digit. 192.168.1.300 is not even valid IPv4, because an octet cannot exceed 255.",
  run="python3 -c \"import ipaddress\nfor a in ['2001:db8::1','2001::db8::1','2001:db8:g::1']:\n    try: ipaddress.ip_address(a); print(a)\n    except ValueError: pass\"", expect="2001:db8::1")
S("4.4", "Which file maps hostnames to IP addresses locally, and is normally checked before DNS?",
  ["✔/etc/hosts", "/etc/resolv.conf", "/etc/hostname", "/etc/nsswitch.conf"],
  "Entries in /etc/hosts, such as `192.168.0.15 fileserver`, are resolved without a DNS query. /etc/nsswitch.conf sets the lookup order (files before dns by default), /etc/resolv.conf lists the DNS servers, and /etc/hostname holds this machine's name.")
S("4.4", "Which command shows the routing table, including the default gateway?",
  ["✔ip route show", "ip addr show", "ss -t", "host -r"],
  "`ip route show` (or `ip r`) lists routes, and the `default via` line is the gateway. The older `route -n` and `netstat -r` show the same information. `ip addr` shows addresses, and `ss` shows sockets.",
  run=None)
F("4.4", "Type the command that tests whether a remote host is reachable by sending ICMP echo requests.",
  ["ping"],
  "`ping host` sends ICMP echo requests and reports replies and round-trip times. On Linux it runs until you press Ctrl+C unless you limit it with `-c`. `ping6` (or `ping -6`) tests IPv6. A failed ping may just mean a firewall blocks ICMP.")
S("4.4", "Which command looks up the IP address of example.com using DNS?",
  ["✔host example.com", "ip host example.com", "route example.com", "ss example.com"],
  "`host` performs DNS lookups, and `dig` gives more detailed output. `ip`, `route` and `ss` show local network configuration rather than querying DNS.")
S("4.4", "Which commands can list open network sockets and listening ports?",
  ["✔ss", "✔netstat", "ping", "host", "ifconfig"],
  "`ss` (such as `ss -tuln`) is the modern tool, and `netstat -tuln` is its older equivalent. ping tests reachability, host queries DNS, and ifconfig shows interface addresses.",
  run=None)
F("4.4", "Type the number of bits in an IPv4 address.",
  ["32"],
  "IPv4 addresses are 32 bits, written as four decimal octets (0 to 255) such as 192.168.1.10. IPv6 addresses are 128 bits. A /24 prefix means the first 24 bits identify the network.")
S("4.4", "A host has the address 192.168.1.50/24. Which address is on the same network?",
  ["✔192.168.1.200", "192.168.2.50", "192.169.1.50", "10.168.1.50"],
  "/24 means the first three octets (192.168.1) are the network, so any 192.168.1.1 to 192.168.1.254 host is local. The other addresses differ in the network portion and would be reached through a router.",
  run="python3 -c \"import ipaddress;n=ipaddress.ip_network('192.168.1.0/24');print([a for a in ['192.168.1.200','192.168.2.50','192.169.1.50','10.168.1.50'] if ipaddress.ip_address(a) in n][0])\"", expect="OPT")
S("4.4", "What does a router do on a network?",
  ["✔Forwards packets between different networks, such as LAN and internet", "Assigns permanent MAC addresses to network cards",
   "Translates hostnames such as example.com into IP addresses for clients", "Connects devices only within a single switch"],
  "A router moves packets between networks using its routing table, and your default gateway is the router your traffic leaves through. MAC addresses are burned into network cards, DNS translates names, and switches connect devices within one LAN.")
