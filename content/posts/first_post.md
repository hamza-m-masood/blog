+++
title = 'Docker Overview'
author = 'Hamza Masood'
+++

## Why Do You Need Docker?

### Let's say you need to create an application:
The web server is created using nodejs, express.\
The database is created using mongoDB.\
The messaging system is created using redis.\
Finally, you might also need an orchestration system such as Ansible. 


### Without using Docker, you may come across a number of issues:

1. The compatability of the various application components with the underlying OS. For example, certain versions of the services might not be compatible with the operating system. 
2. The compatibility of each service with the underlying libraries of the operating system. For example, one service might need a version of a library in the operating system while another service might need some other version. 
3. If the architecture of your application stack changes then you would have to step through these issues once again making sure everything is compatible.
   {{< admonition type=note open=true >}}
   The issues listed above are also known as **Matrix Hell**.
   {{< /admonition >}}


4. Each developer needs to make sure that they correct configure their operating system in order to run the application. 
5. You might also have different environments such as development, test, and production. With this method you could not confidently guarantee that the application is running the same way in all three environments.

## What Can It Do?

Taking the above issues into account, Docker finds a way to solve these three problems:
1. It resolves the compatibility issue.
2. It allows you to modify one component of the application without effecting another. 
3. It allows you to change the architecture of your application without having to worry about the underlying operating system. 

With Docker you are able to run each component of the application in a seperate container with it's own dependencies/libraries.

## What are Containers?

Containers are isolated environments that have their own processes, services, network interfaces etc... just like virtual machines, except, they all share the same operating system kernel. You just need to write the Dokcer configuration once, and can then easily replicate the environment. The other developer just has to make sure that they also have Docker installed on their system.

## Operating System and Sharing The Kernel
Looking at an example operating system such as ubuntu, we can see that it sits on top of a Kernel. The Kernel remains the same while the software that sits above it is what constitutes as the operating system. This is where you have the user interface, drivers, compilers etc... I stated in the previous paragraph that Docker shares the same operating system kernel. What I mean by that is Docker can run any underlying OS in the container while sharing the same Kernel with other containers. There is one exception to this rule if you are running containers on a Linux kernel. You will not be able to run Windows containers. For windows containers, you would need to run a windows server. 

## Docker vs Virtual Machines
Docker runs on an operating system, which sits on top of a kernel, which then sits on top of hardware infrastructure. You can then build containers with Docker, with their  own separate, and isolated libraries and dependencies. 

For Virtual machines, you have Hypervisors (such as ESX) that sit on top of hardware infrastructure. Each virtual machine gets a portion of memory and processing power through the hypervisor to run it's own kernel and operating system. 

This results in higher utilization of memory, CPU, and disk space, since each VM is heavy, whereas Docker containers are lighter and usually megabytes in size. 

Since Docker containers are lighter, it allows them to boot up much faster than VMs.

It is also important to note that Docker has less isolation, since it is sharing resources from a Kernel, while VMs have their own separate kernel. 

Finally, VMs can run all sorts of operating systems on the same Hypervisor such as windows and linux. Whereas on Docker, you would have to choose the types of operating systems you want to run beforehand, since Docker relies on the underlying operating system.

## Using a Virtual Docker Host
It is possible to run Docker on a virtual machine. Whit this way, you can take advantage of both running virtual machines and Docker! You will not have to provision that many virtual machines. Instead of provisioning virtual machines for each application, you would now only hae to provision virtual machines to host containers.

## How Can I Run Docker?
Once Docker is installed, you can pull Docker Images from a Docker repository such as [Docker Hub](https://hub.docker.com/).   
