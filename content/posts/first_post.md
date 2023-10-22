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

Containers are isolated environments that have their own processes, services, network interfaces etc... just like virtual machines, except, they all share the same operating system kernel.
